import {guardDepartureClock,zoneOffsetMinutes} from "./local-time-guard.js";
import {isWebWordRegistration} from "./registration-guard.js";
import {fetchFr24Public} from "./fr24-public-html.js";
import {boardLookup,gateValue} from "./fr24-board.js";
import {withIcaoFallback,matchesFlightStatsOccurrence,publicPageStatus,flightLookupVariants} from "./public-flight-alias.js";
import {flightAwareJsonSemantic,cleanFlightAwareUrl} from "./flightaware-page-times.js";
import {flightOperationalStatus} from "./flight-operational-status.js";
import {AIRPORT_TZ} from "./airport-tz.js";
import {noteActualAircraft} from "./aircraft-change.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})/);return m?`${String(Number(m[1])).padStart(2,"0")}:${m[2]}`:""};
const mins=v=>{const t=hhmm(v);if(!t)return null;const [h,m]=t.split(":").map(Number);return h*60+m};
const addMinutes=(v,d)=>{const n=mins(v);if(n==null)return "";const x=(n+Number(d)+1440)%1440;return `${String(Math.floor(x/60)).padStart(2,"0")}:${String(x%60).padStart(2,"0")}`};
const parisDate=()=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const manual=(x,f)=>upper(x?.[f+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[f]||x?.manualOverrides?.[f]||x?.manual_fields?.[f]);
const EXACT_FR24={"LO334|2026-10-03":"41f2d8d9","RJ120|2026-10-03":"41f2da8b","TK1830|2026-10-03":"41f2d733","AV55|2026-10-03":"41f30e95","HF177|2026-10-03":"41f31243","SQ335|2026-10-03":"41f35170","SQ337|2026-10-03":"41f57355","HU718|2026-10-03":"41f38aae","VF12|2026-10-03":"41f3a1d1","SM3778|2026-10-03":"41f44e42","VF10|2026-10-03":"41f48b45","VF516|2026-10-03":"41f490f9","TK1834|2026-10-03":"41f49d19","AH1215|2026-10-03":"41f4d035","BJ509|2026-10-03":"41f4e029","NH216|2026-10-03":"41f4e62f","OZ502|2026-10-03":"41f4ec4d","TK1828|2026-10-03":"41f4f61e","LO336|2026-10-03":"41f4f8fe","SK560|2026-10-03":"41f51360","AH1085|2026-10-03":"41f51d65","BM591|2026-10-03":"41f4f154","TW402|2026-10-03":"41f51c07"};

// LIVE automatique: uniquement les sources qui ont prouvé une valeur opérationnelle.
// FlightAware est traité séparément par flightaware-exact-history.js (occurrence exacte + cooldown).
export const LIVE_PUBLIC_SOURCE_ORDER={
  atd:["FlightStats","FlightAware exact","FR24Board","FR24","PlaneFinder","Skyscanner"],
  status:["FR24","FlightStats","PlaneFinder","Skyscanner"],
  eta:["FR24","FlightAware exact","FlightStats","PlaneFinder","Skyscanner"],
  ata:["FlightStats","FlightAware exact","PlaneFinder","Skyscanner"],
  takeoff:["FR24","FlightAware exact","PlaneFinder","FlightStats"],
  landing:["FR24","FlightAware exact","FlightStats","PlaneFinder"],
  aircraft:["FR24","FR24Board","PlaneFinder","FlightStats","Skyscanner"],
  reg:["FR24","FR24Board","PlaneFinder","FlightStats","Skyscanner"]
};
const ACTIVE_HTML=["FLIGHTSTATS","PLANEFINDER","SKYSCANNER"];
const FALLBACKS={
  FLIGHTSTATS:f=>`https://www.flightstats.com/v2/flight-tracker/${encodeURIComponent(f.airline)}/${encodeURIComponent(f.number)}?year=${f.date.slice(0,4)}&month=${Number(f.date.slice(5,7))}&date=${Number(f.date.slice(8,10))}`,
  PLANEFINDER:f=>`https://planefinder.net/data/flight/${encodeURIComponent(f.designator)}`,
  SKYSCANNER:f=>`https://www.skyscanner.net/flight-tracker/${encodeURIComponent(f.designator.toLowerCase())}`
};
// ---- FlightAware, generic: find the page of THIS occurrence from the flight's landing page, then read the times it embeds (JSON, any language). ----
// Used only for a flight without any departure fact after FR24 / FlightStats. The found URL is kept on the flight (flightAwareHistoryUrl): the exact-history
// recovery then refreshes it directly at each run. A 429 pauses every FlightAware call of this isolate for 45 min.
let flightAwareCooldownUntil=0;
const FS_UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const FA_HEADERS={accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-FlightAwareLive/1.0)"};
async function faGet(url,timeout=8000){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{redirect:"follow",signal:c.signal,headers:FA_HEADERS});return {httpStatus:r.status,raw:r.ok?await r.text():""}}catch(e){return {httpStatus:0,raw:"",error:e?.name==="AbortError"?"TIMEOUT":"FETCH_ERROR"}}finally{clearTimeout(t)}}
export function flightAwareHistoryUrl(raw,f){
  const src=String(raw||"").replace(/\\\//g,"/").replace(/&amp;/g,"&"),found=[];
  for(const m of src.matchAll(/https?:\/\/(?:www\.)?flightaware\.com\/live\/flight\/[A-Z0-9]+\/history\/(\d{8})\/(\d{4})Z\/([A-Z]{4})\/([A-Z]{4})/g))found.push({url:m[0],day:m[1],hm:m[2],origin:m[3]});
  const dep=String(f.std||"").match(/(\d{1,2}):(\d{2})/),d=String(f.date||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!dep||!d)return "";
  const stdUtc=Date.UTC(+d[1],+d[2]-1,+d[3],+dep[1],+dep[2])/60000-zoneOffsetMinutes(f.date,AIRPORT_TZ[upper(f.origin||"CDG")]||"Europe/Paris");
  let best="",gap=241;
  for(const c of found){
    if(upper(f.origin||"CDG")==="CDG"&&c.origin!=="LFPG")continue;
    const at=Date.UTC(+c.day.slice(0,4),+c.day.slice(4,6)-1,+c.day.slice(6,8),+c.hm.slice(0,2),+c.hm.slice(2,4))/60000,diff=Math.abs(at-stdUtc);
    if(diff<gap){gap=diff;best=c.url}
  }
  return best;
}
async function fetchFlightAwareLive(f,knownUrl){
  if(Date.now()<flightAwareCooldownUntil)return {status:"COOLDOWN"};
  let url=cleanFlightAwareUrl(knownUrl),discovered=false;
  if(!url){
    const designator=(flightLookupVariants({airline:f.airline,number:f.number}).find(v=>v.lookupCodeType==="ICAO"&&v.lookupNumberType==="RAW")||{}).designator||f.designator;
    const landing=await faGet(`https://www.flightaware.com/live/flight/${encodeURIComponent(designator)}`);
    if(landing.httpStatus===429){flightAwareCooldownUntil=Date.now()+45*60000;return {status:"HTTP_429"}}
    url=flightAwareHistoryUrl(landing.raw,f);if(!url)return {status:landing.httpStatus===200?"NO_OCCURRENCE_URL":(landing.error||"HTTP_"+landing.httpStatus)};
    discovered=true;
  }
  const page=await faGet(url);
  if(page.httpStatus===429){flightAwareCooldownUntil=Date.now()+45*60000;return {status:"HTTP_429"}}
  if(page.httpStatus!==200)return {status:page.error||"HTTP_"+page.httpStatus,url};
  const semantic=flightAwareJsonSemantic(page.raw,{origin:f.origin||"CDG",destination:f.destination});
  return {status:Object.values(semantic).some(Boolean)?"OK":"NO_PARSED_FIELDS",url,discovered,semantic};
}
function normalizeFlight(row,x){const airline=upper(x.airline||row.airline),designator=upper(x.flight||row.flight_number),number=designator.startsWith(airline)?designator.slice(airline.length):String(row.flight_number||"").replace(/^[A-Z0-9]{2,3}(?=\d)/,"");const id=EXACT_FR24[`${designator}|${row.flight_date}`]||clean(x.fr24OccurrenceId||x.fr24_occurrence_id);return {date:row.flight_date,airline,number,designator,origin:upper(x.origin||"CDG"),destination:upper(x.destination||x.dest||""),std:hhmm(x.std||row.std),raw:{...x,fr24OccurrenceId:id}}}
function textOnly(h){return String(h||"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/\s+/g," ").trim()}
function around(text,f){const u=upper(text),keys=[upper(f.designator),`${upper(f.airline)} ${upper(f.number)}`];let i=-1;for(const k of keys){i=u.indexOf(k);if(i>=0)break}return i<0?String(text||"").slice(0,7000):String(text||"").slice(Math.max(0,i-3000),Math.min(String(text||"").length,i+9000))}
function normTime(raw){let s=upper(raw).replace(/H/,":");const m=s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);if(!m)return "";let h=Number(m[1]),mi=Number(m[2]);if(mi>59||h>23)return "";if(m[3]){if(h>12||h===0)return "";if(m[3]==="AM"&&h===12)h=0;if(m[3]==="PM"&&h!==12)h+=12}return `${String(h).padStart(2,"0")}:${String(mi).padStart(2,"0")}`}
function firstTime(text,patterns){for(const p of patterns){const m=String(text||"").match(p);if(m){const v=normTime(m[1]);if(v)return v}}return ""}
const REGISTRATION_RE=/\b(F-[A-Z]{4}|TC-[A-Z]{3}|TS-[A-Z]{3}|SU-[A-Z]{3}|CC-[A-Z]{3}|9V-[A-Z]{3}|9M-[A-Z]{3}|EI-[A-Z]{3}|SP-[A-Z]{3}|YU-[A-Z]{3}|LZ-[A-Z]{3}|9XR-[A-Z]{2,3}|7T-[A-Z]{3}|HL\d{4}|JA\d{3,4}[A-Z]?|VT-[A-Z]{3}|CN-[A-Z]{3}|N\d{1,5}[A-Z]{0,2}|[A-Z]{1,2}-[A-Z]{3,5})\b/gi;
// The first plausible registration of the page text (web words such as E-MAIL look like one and are skipped).
function registration(t){for(const m of String(t||"").matchAll(REGISTRATION_RE)){const v=upper(m[1]);if(v&&!isWebWordRegistration(v))return v}return ""}
// A bare 3-character code equal to the flight number is the flight itself, not a type (LY320 was read as a "320" aircraft change from "LY 320").
function aircraft(t,f){const re=/\b(A20N|A21N|A319|A320|A321|A332|A333|A339|A343|A350|A359|A380|B38M|B39M|B737|B738|B739|B748|B752|B753|B763|B764|B772|B773|B77W|B788|B789|BCS1|BCS3|32B|32Q|77W|788|789|359|333|332|320|321)\b/gi,num=upper(f?.number||String(f?.designator||"").replace(/^[A-Z0-9]{2,3}?(?=\d)/,""));let m;const text=String(t||"");while((m=re.exec(text))){const v=upper(m[1]);if(num&&v===num&&/^[0-9A-Z]{3}$/.test(v))continue;return v}return ""}
function statusValue(t){const s=upper(t);if(/CANCEL|ANNUL/.test(s))return "ANNULÉ";if(/DIVERT|DÉROUT|DEROUT/.test(s))return "DÉROUTÉ";if(/ARRIVED AT GATE|ARRIVÉE|ARRIVED\b/.test(s))return "ARRIVÉE";if(/LANDED|ATTERI/.test(s))return "ATTERI";if(/IN AIR|AIRBORNE|IN FLIGHT|EN VOL|EN ROUTE|DEPARTED/.test(s))return "EN VOL";if(/DELAY|RETARD/.test(s))return "RETARDÉ";if(/ON TIME|SCHEDULED|PRÉVU|PREVU/.test(s))return "PRÉVU";return ""}
// FlightStats "Flight Details" layout: Departure / Arrival, each with "Flight Gate Times" (gate = ATD / ATA) and "Flight Runway Times" (runway = takeoff / landing).
// Labels (Scheduled / Estimated / Actual) may sit above their values or in front of each one: both orders are read.
export function flightStatsBlockTimes(segment){
  const toks=[],re=/\b(Scheduled|Estimated|Actual)\b|(?<![+\d:])(\d{1,2}:\d{2})(?![\d:])|(--)/g;let m;
  const seg=String(segment||"").replace(/UTC\s*[+\-−]\s*\d{1,2}(?::?\d{2})?/g," ");
  while((m=re.exec(seg)))toks.push(m[1]?{l:m[1]}:{v:m[2]||""});
  const labels=[],values=[];let grouped=false;
  if(toks.length>1&&toks[0].l!==undefined&&toks[1].l!==undefined)grouped=true;
  if(grouped){for(const t of toks){if(t.l!==undefined){if(!values.length)labels.push(t.l)}else values.push(t.v)}}
  else{for(let i=0;i<toks.length;i++){if(toks[i].l!==undefined&&toks[i+1]&&toks[i+1].l===undefined){labels.push(toks[i].l);values.push(toks[i+1].v);i++}}}
  const out={};labels.forEach((l,i)=>{out[l.toLowerCase()]=values[i]||""});return out;
}
// The FlightStats page names the flight of the requested date in several places: the "view details" link (…/flight-details/MH/21?year=2026&month=10&date=5&flightId=…),
// the path form (…/flight-details/TS/111/2026/10/5/1412363884) and the JSON data ("flightId":1412363884 followed by its date). Every form is read; the id is used only when they all agree.
export function flightStatsFlightId(raw,date){
  const m=String(date||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return "";
  const body=String(raw||"").replace(/&amp;|\\u0026|&#38;/g,"&").replace(/\\\//g,"/"),want={year:m[1],month:String(Number(m[2])),date:String(Number(m[3]))},ids=new Set();
  for(const x of body.matchAll(/flight-details\/[^"'\s<>]*?\?([^"'\s<>]*)/g)){
    const q=new URLSearchParams(x[1]),id=q.get("flightId");
    if(id&&/^\d+$/.test(id)&&q.get("year")===want.year&&q.get("month")===want.month&&q.get("date")===want.date)ids.add(id);
  }
  for(const x of body.matchAll(/flight-details\/[A-Z0-9]+\/\d+\/(\d{4})\/(\d{1,2})\/(\d{1,2})\/(\d+)/g)){
    if(x[1]===want.year&&String(Number(x[2]))===want.month&&String(Number(x[3]))===want.date)ids.add(x[4]);
  }
  for(const x of body.matchAll(/"flightId"\s*:\s*"?(\d{6,})"?/g)){
    const ahead=body.slice(x.index,x.index+2500),d=ahead.match(/"date"\s*:\s*"(\d{4})-(\d{2})-(\d{2})/);
    if(d&&d[1]===want.year&&d[2]===m[2]&&d[3]===m[3])ids.add(x[1]);
  }
  return ids.size===1?[...ids][0]:"";
}
// FlightStats serves the same data as JSON (…/v2/api/extendedDetails/TS/111/2026/10/5/<flightId>): clean times (time24, local to each airport), status, tail number and aircraft.
export function flightStatsApiTimes(j){
  if(!j||typeof j!=="object")return null;
  const t=(o,k)=>{const v=o&&o[k]&&o[k].time24;return /^\d{1,2}:\d{2}$/.test(String(v||""))?String(v).padStart(5,"0"):""};
  const dep=j.departureTimes||j.departureAirport?.times||{},arr=j.arrivalTimes||j.arrivalAirport?.times||{},st=j.status||{},label=String(st.status||"");
  const out={atd:t(dep,"actualGate"),takeoff:t(dep,"actualRunway"),ata:t(arr,"actualGate"),landing:t(arr,"actualRunway")};
  out.eta=out.ata?"":t(arr,"estimatedGate");
  if(/cancel/i.test(label)||/^C$/i.test(String(st.statusCode||""))){out.status="ANNULÉ";out.statusStrong=true}
  else if(st.diverted===true||j.divertedAirport)out.status="DÉROUTÉ";
  else if(out.ata)out.status="ARRIVÉE";else if(out.landing)out.status="ATTERI";
  else if(String(j.flightState||"").toLowerCase()==="en-route"||out.atd||out.takeoff)out.status="EN VOL";
  const eq=j.additionalFlightInfo?.equipment||{};
  if(eq.tailNumber)out.reg=upper(eq.tailNumber);
  if(eq.iata)out.aircraft=upper(eq.iata);
  for(const k of Object.keys(out))if(out[k]==="")delete out[k];
  return out;
}
export function flightStatsDetails(text){
  const t=String(text||""),gates=[...t.matchAll(/Flight Gate Times/g)].map(x=>x.index),runs=[...t.matchAll(/Flight Runway Times/g)].map(x=>x.index);
  if(gates.length<2)return null;
  const end=(i,list)=>{const n=list.filter(x=>x>i).sort((a,b)=>a-b)[0];return n===undefined?Math.min(t.length,i+700):n};
  const all=[...gates,...runs],seg=i=>t.slice(i,Math.min(end(i,all),i+700));
  const dep=flightStatsBlockTimes(seg(gates[0])),arr=flightStatsBlockTimes(seg(gates[1]));
  const depRunAt=runs.find(x=>x>gates[0]&&x<gates[1]),arrRunAt=runs.find(x=>x>gates[1]);
  const depRun=depRunAt!==undefined?flightStatsBlockTimes(seg(depRunAt)):{},arrRun=arrRunAt!==undefined?flightStatsBlockTimes(seg(arrRunAt)):{};
  return {atd:dep.actual||"",takeoff:depRun.actual||"",eta:arr.estimated||"",ata:arr.actual||"",landing:arrRun.actual||""};
}
export function semanticText(source,text,f){const w=around(text,f),out={};if(source==="FLIGHTSTATS"){const dep=String(text).split("Flight Departure Times")[1]?.split("Flight Arrival Times")[0]||w,arr=String(text).split("Flight Arrival Times")[1]||w;out.atd=firstTime(dep,[/\bActual\b[^0-9]{0,35}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i,/Actual Departure[^0-9]{0,35}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i]);out.eta=firstTime(arr,[/\bEstimated\b[^0-9]{0,35}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i]);out.ata=firstTime(arr,[/\bActual\b[^0-9]{0,35}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i]);const rw=String(text).split("Flight Runway Times");if(rw.length>1){out.takeoff=firstTime(rw[1].split("Flight Gate Times")[0].split("Terminal")[0],[/\bActual\b[^0-9]{0,35}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i])}}else{out.atd=firstTime(w,[/(?:gate departure|gate out|left gate|actual departure|ATD|départ porte)[^0-9]{0,40}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i]);out.eta=firstTime(w,[/(?:estimated gate arrival|estimated arrival|arrival estimate|ETA|arrivée estimée)[^0-9]{0,40}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i]);out.ata=firstTime(w,[/(?:gate arrival|gate in|arrived at gate|actual arrival|ATA|arrivée réelle)[^0-9]{0,40}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i])}out.status=source==="FLIGHTSTATS"&&/Flight Diverted|Diverted to [A-Z]{3}/i.test(String(text))?"DÉROUTÉ":statusValue(w);if(source==="FLIGHTSTATS"){const d=flightStatsDetails(text);if(d){for(const k of ["atd","takeoff","eta","ata","landing"]){if(d[k])out[k]=d[k];else if(["atd","takeoff","ata","landing"].includes(k))delete out[k]}}}
  // FlightStats states a cancellation in the status banner above the times: that one is explicit (the rest of the page lists other days).
  if(source==="FLIGHTSTATS"){const head=String(text).split("Flight Departure Times")[0].split("Flight Gate Times")[0].slice(-600);if(/\bCancell?ed\b/i.test(head)||/indicated that this flight has been cancell?ed|Flight Cancell?ed/i.test(String(text))){out.status="ANNULÉ";out.statusStrong=true}}out.aircraft=aircraft(w,f);out.reg=registration(w);return out}
function routeMatched(text,f){const u=upper(text);return (!f.origin||u.includes(f.origin))&&(!f.destination||u.includes(f.destination))}
// FlightStats refuses (403) a burst of parallel requests: its requests go one after the other with a short pause (the other sources stay parallel).
let flightStatsChain=Promise.resolve();
// FlightStats refuses bursts (403 / 429 on 86 of 89 flights): one request every 1.5 s, and a pause of 90 s once it has refused twice in a row.
let flightStatsRefusals=0,flightStatsPausedUntil=0;
export function flightStatsNoteResult(status,now=Date.now()){if(status===403||status===429){flightStatsRefusals++;if(flightStatsRefusals>=2)flightStatsPausedUntil=now+90000}else if(status>=200&&status<400)flightStatsRefusals=0}
export function flightStatsPaused(now=Date.now()){return now<flightStatsPausedUntil}
export function flightStatsReset(){flightStatsRefusals=0;flightStatsPausedUntil=0}
export function flightStatsSlot(source,fn,pauseMs=1500){
  if(source!=="FLIGHTSTATS")return fn();
  const run=flightStatsChain.then(()=>fn());
  flightStatsChain=run.catch(()=>{}).then(()=>new Promise(z=>setTimeout(z,pauseMs)));
  return run;
}
// The FlightStats id of a flight does not change during the day: once known, only the light JSON API is called (no tracker page, no WAF challenge).
async function flightStatsFromCachedId(f){
  const id=clean(f.raw?.flightStatsId);if(!/^\d+$/.test(id)||clean(f.raw?.flightStatsIdDate)!==f.date||flightStatsPaused())return null;
  const ymd=f.date.slice(0,4)+"/"+Number(f.date.slice(5,7))+"/"+Number(f.date.slice(8,10)),url=`https://www.flightstats.com/v2/api/extendedDetails/${encodeURIComponent(f.airline)}/${encodeURIComponent(f.number)}/${ymd}/${id}`,c=new AbortController(),t=setTimeout(()=>c.abort(),10000),checkedAt=new Date().toISOString();
  try{
    const r=await flightStatsSlot("FLIGHTSTATS",()=>fetch(url,{redirect:"follow",signal:c.signal,headers:{accept:"*/*","accept-language":"en-US,en;q=0.9",referer:"https://www.flightstats.com/v2","user-agent":FS_UA}}));
    flightStatsNoteResult(r.status);
    if(!r.ok)return null;
    const a=flightStatsApiTimes(await r.json().catch(()=>null));if(!a||!Object.keys(a).length)return null;
    return {source:"FLIGHTSTATS",url,httpStatus:r.status,status:"OK",checkedAt,semantic:a,lookupDesignator:f.designator,lookupCodeType:"IATA",detailsInfo:"API OK (id mémorisé)",flightId:id};
  }catch{return null}finally{clearTimeout(t)}
}
async function fetchHtmlSource(source,f){if(source==="FLIGHTSTATS"){const cached=await flightStatsFromCachedId(f);if(cached)return cached;if(flightStatsPaused())return {source,status:"COOLDOWN",httpStatus:0,checkedAt:new Date().toISOString(),semantic:{},detailsInfo:"En pause 90 s après deux refus"}}const build=FALLBACKS[source];if(!build)return {source,status:"NO_SOURCE",semantic:{}};return withIcaoFallback(f,build,async candidate=>{const url=build(candidate),c=new AbortController(),t=setTimeout(()=>c.abort(),source==="FLIGHTSTATS"?10000:6500),checkedAt=new Date().toISOString();try{const init={redirect:"follow",signal:c.signal,headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":source==="FLIGHTSTATS"?FS_UA:"Mozilla/5.0 (compatible; AlyziaOpsV2-LiveOptimized/1.0)"}};let r=await flightStatsSlot(source,()=>fetch(url,init));if(source==="FLIGHTSTATS")flightStatsNoteResult(r.status);
  // FlightStats answers 403 / 429 to a burst of parallel requests (AI142: IATA lookup refused in the cron, fine alone): one retry after a short pause.
  if(source==="FLIGHTSTATS"&&(r.status===403||r.status===429)){await new Promise(z=>setTimeout(z,900+Math.floor(Math.random()*700)));r=await flightStatsSlot(source,()=>fetch(url,init));flightStatsNoteResult(r.status)}
  const raw=await r.text(),text=textOnly(raw),mentions=upper(text).includes(upper(candidate.designator))||upper(text).includes(`${upper(candidate.airline)} ${upper(candidate.number)}`);let status=publicPageStatus(source,text,r.status,mentions,routeMatched(text,candidate));if(status==="OK"&&source==="FLIGHTSTATS"&&!matchesFlightStatsOccurrence(text,{...candidate,date:f.date,origin:f.origin,destination:f.destination}))status="OCCURRENCE_MISMATCH";let semantic=status==="OK"?semanticText(source,text,candidate):{},detailsInfo="",fsId="";
  if(status==="OK"&&source==="FLIGHTSTATS"){
    // Gate and runway times (ATD/ATA, takeoff/landing) are on the "Flight Details" page of the exact flight.
    const id=flightStatsFlightId(raw,f.date);fsId=id;
    if(id){try{
      const base=new URL(r.url||url),parts=base.pathname.split("/").filter(Boolean),ti=parts.indexOf("flight-tracker"),car=parts[ti+1],num=parts[ti+2];
      const ymd=f.date.slice(0,4)+"/"+Number(f.date.slice(5,7))+"/"+Number(f.date.slice(8,10));
      let done=false;
      if(car&&num){
        const au=`https://www.flightstats.com/v2/api/extendedDetails/${car}/${num}/${ymd}/${id}`,ar=await flightStatsSlot(source,()=>fetch(au,{...init,headers:{...init.headers,accept:"*/*",referer:"https://www.flightstats.com/v2"}}));detailsInfo="API HTTP "+ar.status;
        if(ar.ok){const a=flightStatsApiTimes(await ar.json().catch(()=>null));if(a&&Object.keys(a).length){detailsInfo="API OK";done=true;for(const k of ["atd","takeoff","eta","ata","landing"]){if(a[k])semantic[k]=a[k];else if(["atd","takeoff","ata","landing"].includes(k))delete semantic[k]}for(const k of ["status","statusStrong","reg","aircraft"])if(a[k]!==undefined)semantic[k]=a[k]}}
      }
      if(!done){
        const du=new URL(r.url||url);du.pathname=du.pathname.replace("/flight-tracker/","/flight-details/");du.search="?year="+f.date.slice(0,4)+"&month="+Number(f.date.slice(5,7))+"&date="+Number(f.date.slice(8,10))+"&flightId="+id;
        const dr=await flightStatsSlot(source,()=>fetch(du.toString(),init));detailsInfo+=" · page HTTP "+dr.status;
        if(dr.ok){const d=flightStatsDetails(textOnly(await dr.text()));if(d){detailsInfo="PAGE OK";for(const k of ["atd","takeoff","eta","ata","landing"]){if(d[k])semantic[k]=d[k];else if(["atd","takeoff","ata","landing"].includes(k))delete semantic[k]}}else detailsInfo+=" · NO_BLOCKS"}
      }
    }catch(e){detailsInfo="ERROR "+String(e?.message||e).slice(0,60)}}else detailsInfo="NO_FLIGHT_ID"+(/flightId/.test(raw)?" (flightId présent, date non reconnue)":" (aucun flightId dans la page)");
  }
  return {source,url:r.url||url,httpStatus:r.status,status,checkedAt,semantic,detailsInfo:detailsInfo||undefined,flightId:fsId||undefined,lookupDesignator:candidate.designator,lookupCodeType:candidate.lookupCodeType}}catch(e){return {source,url,status:e?.name==="AbortError"?"TIMEOUT":"FETCH_ERROR",httpStatus:0,checkedAt,semantic:{},error:String(e?.message||e).slice(0,160)}}finally{clearTimeout(t)}})}
function clockFromIso(iso,zone){if(!iso)return "";const d=new Date(iso);if(Number.isNaN(d.getTime()))return "";try{const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:zone||"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d).map(x=>[x.type,x.value]));return `${p.hour}:${p.minute}`}catch{return ""}}
// FR24's "actual departure" is the wheels-up time (MH21: FR24 12:02/12:03, FlightStats and FlightAware gate departure 11:50): it feeds TAKEOFF only, never ATD.
export function fr24Semantic(fr,f){const s=fr?.candidates?.semantic||{};const takeoff=clockFromIso(s.takeoff,"Europe/Paris"),history=clean(s.atdClock);return {takeoff:takeoff||history,eta:clockFromIso(s.eta,AIRPORT_TZ[f.destination]||"Europe/Paris"),landing:clockFromIso(s.landing,AIRPORT_TZ[f.destination]||"Europe/Paris")||clean(s.landingClock),status:statusValue(s.status||fr?.candidates?.statuses?.join(" ")||""),aircraft:upper(s.type||fr?.candidates?.aircraft?.[0]),reg:upper(s.reg||fr?.candidates?.registrations?.[0])}}
function choose(map,field,order){for(const src of order){const key=upper(src).replace(/[^A-Z0-9]/g,"");const hit=map[key]||map[src];const v=clean(hit?.[field]);if(v)return {value:v,source:key==="FLIGHTSTATSEXACT"?"FLIGHTSTATS":key}}return {value:"",source:""}}
// A cancellation read on a web page is only believed when two sources agree: a single loose page text ("cancelled" elsewhere on the page) was wrong for AI142 / TU725.
export function pickStatus(map,order){
  const count=st=>Object.values(map||{}).filter(v=>clean(v?.status)===st).length,cancelled=count("ANNULÉ"),diverted=count("DÉROUTÉ");
  for(const [k,v] of Object.entries(map||{}))if(v?.statusStrong&&clean(v.status)==="ANNULÉ")return {value:"ANNULÉ",source:k};
  for(const src of order){const key=upper(src).replace(/[^A-Z0-9]/g,"");const v=clean((map[key]||map[src])?.status);if(!v)continue;if(v==="ANNULÉ"&&cancelled<2&&!(map[key]||map[src])?.statusStrong)continue;if(v==="DÉROUTÉ"&&diverted<2)continue;return {value:v,source:key==="FLIGHTSTATSEXACT"?"FLIGHTSTATS":key}}
  return {value:"",source:""}
}
// "En vol / atterri / arrivé" read on a web page is only believed once the flight has a departure fact (ATD, takeoff, landing or ATA):
// TU723 was "EN VOL" while FlightStats said Scheduled, delayed 4h10.
export function guardAirborneStatus(status,x){
  if(!/^(EN VOL|ATTERI|ARRIV)/.test(upper(status)))return status;
  if(["atd","takeoff","landing","ata"].some(k=>clean(x?.[k])))return status;
  const kept=clean(x?.status);
  return kept&&!/^(EN VOL|ATTERI|ARRIV)/.test(upper(kept))?kept:(clean(x?.etd||x?.edt)&&clean(x?.etd||x?.edt)!==clean(x?.std)?"RETARDÉ":"PRÉVU");
}
// Two sources must agree (same clock, 2 min tolerance) for a time to be confirmed; a value from a single source is still written but flagged.
function clockMin(v){const m=clean(v).match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null}
export function confirmation(map,field,value){
  const a=clockMin(value);if(a===null)return {confirmed:false,sources:[]};
  const sources=Object.entries(map||{}).filter(([,v])=>{const b=clockMin(v?.[field]);if(b===null)return false;let d=Math.abs(a-b);if(d>720)d=1440-d;return d<=2}).map(([k])=>k);
  return {confirmed:sources.length>=2,sources};
}
function setField(x,field,hit,at){if(!hit?.value||manual(x,field))return false;
  // Departure clocks must be local to the origin: a UTC reading (more than 50 min before STD) is shifted, an impossible one refused.
  if(field==="atd"||field==="takeoff"){const g=guardDepartureClock(hit.value,x.std,x.activeDate||x.date,AIRPORT_TZ[upper(x.dep||x.origin||"CDG")]||"Europe/Paris");if(g.status==="REJECTED")return false;if(g.status==="SHIFTED")hit={...hit,value:g.value,source:`${hit.source}+LOCALIZED`}}
  const before=clean(x[field]);if(before===hit.value)return false;const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:`PUBLIC_LIVE:${hit.source}`,field,from:before,to:hit.value});x.flightInfoLog=log.slice(0,240);x[field]=hit.value;x[field+"Source"]=`PUBLIC_LIVE:${hit.source}`;x[field+"UpdatedAt"]=at;if(field==="reg"){x.registration=hit.value;x.aircraftRegistration=hit.value}return true}
function needFromCurrent(x){return {atd:!clean(x.atd)||suspectAtd(x),eta:!clean(x.eta),ata:!clean(x.ata),status:!clean(x.status),aircraft:!clean(x.aircraftActual||x.aircraft),reg:!clean(x.reg||x.registration)||isWebWordRegistration(x.reg||x.registration),takeoff:!clean(x.takeoff),landing:!clean(x.landing)}}
function anyNeed(n,keys){return keys.some(k=>n[k])}
async function readCurrent(env,id){const r=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE identity=? LIMIT 1`).bind(id).first();if(!r)return null;try{return JSON.parse(r.data_json||"{}")}catch{return {}}}
async function saveMeta(env,data){try{await env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS ops_meta(k TEXT PRIMARY KEY,v TEXT)`).run();await env.OPS_DB.prepare(`INSERT INTO ops_meta(k,v) VALUES('v2_public_live_last',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(JSON.stringify(data)).run()}catch{}}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let n=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{for(;;){const i=n++;if(i>=items.length)return;out[i]=await fn(items[i])}}));return out}
// Slot order of one run: (0) departure due or just missed with no ATD/takeoff yet (most time-critical, so they never wait behind the airborne flights),
// (1) airborne flights waiting for their arrival, (2) a missing ETA or a departure missed by more than 6 h without ATD (still retried, never starved), (3) departures within 2 h, (4) the rest.
const addDaysIso=(d,n)=>{const t=new Date(`${d}T12:00:00Z`);t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)};
// Minutes since the start of the flight's own day: after midnight (Paris) an evening departure of yesterday is in the past, not "22:35 > 01:39 so still ahead".
export function minutesOnFlightDay(flightDate,today,nowMin){const a=Date.parse(`${flightDate}T00:00:00Z`),b=Date.parse(`${today}T00:00:00Z`);const days=Number.isFinite(a)&&Number.isFinite(b)?Math.round((b-a)/86400000):0;return nowMin+1440*Math.max(0,days)}
// Minutes elapsed since a local clock reading (a past fact, so less than 24 h) in the given zone.
export function minutesSinceLocalClock(clockValue,zone,now=new Date()){
  const c=mins(clockValue);if(c==null)return null;
  try{const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:zone||"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now).map(x=>[x.type,x.value]));return ((Number(p.hour)*60+Number(p.minute)-c)%1440+1440)%1440}catch{return null}
}
// Landed for 15 minutes or more without an ATA: the gate arrival is taken as landing + 10 min (ENT / E4: at once, as before).
export function deriveAta(landingValue,zone,airline,now=new Date()){
  const ld=clean(landingValue);if(!ld)return null;
  const el=minutesSinceLocalClock(ld,zone,now);
  if(/^(E4|ENT)$/.test(upper(airline))||(el!==null&&el>=15))return {value:addMinutes(ld,10),source:"DERIVED_LANDING_PLUS_10"};
  return null;
}
// An ATD that is only the FR24 takeoff copied over (older readings): it is re-read first so FlightStats / FlightAware can give the real gate departure.
export function suspectAtd(x){return Boolean(clean(x?.atd))&&clean(x.atd)===clean(x.takeoff)&&/FR24/.test(upper(x.atdSource))&&!manual(x,"atd")}
// Airborne flight arriving within 2 h (or just overdue): its ETA moves most, so it is re-read first, at most every 3 minutes.
const INFLIGHT_WINDOW_MIN=120,INFLIGHT_REREAD_MIN=3;
export function arrivingSoon(x,nowMs=Date.now()){const a=Date.parse(clean(x?.statusArrivalUtc));if(!Number.isFinite(a)||clean(x?.ata))return false;const m=(a-nowMs)/60000;return m<=INFLIGHT_WINDOW_MIN&&m>=-30}
export function priority(row,x,nowMin,nowMs=Date.now()){const std=mins(x.std||row.std),checked=Date.parse(x.publicLiveBackfill?.checkedAt||0)||0,departed=Boolean(clean(x.atd)||clean(x.takeoff));if(suspectAtd(x))return [0,checked];
  // Took off but no ATD yet (FR24 no longer gives it): FlightStats / FlightAware are asked again, every 5 minutes at most, for 2 h after takeoff.
  if(!clean(x.atd)&&clean(x.takeoff)&&!clean(x.ata)&&nowMs-checked>=5*60000){const since=minutesSinceLocalClock(x.takeoff,AIRPORT_TZ[upper(x.dep||x.origin||"CDG")]||"Europe/Paris",new Date(nowMs));if(since!==null&&since<=120)return [0.4,checked]}if(departed&&!clean(x.ata)&&arrivingSoon(x,nowMs)&&nowMs-checked>=INFLIGHT_REREAD_MIN*60000)return [0.5,checked];if(!departed&&std!=null&&std<=nowMin+30)return [nowMin-std>360?2:0,checked];if(departed&&!clean(x.ata))return [1,checked];if(!clean(x.eta)&&clean(x.atd))return [2,checked];if(std!=null&&std<=nowMin+120)return [3,checked];return [4,checked]}
// A quarter of the slots (at least one) is kept for flights of the second tier or later (missing ETA, departure missed long ago): otherwise the airborne
// flights, which are always more numerous than the slots in the evening, would starve them for good.
export function pickSlots(sorted,size){
  const reserve=Math.min(size,Math.max(1,Math.floor(size/4))),head=sorted.slice(0,size-reserve),rest=sorted.slice(size-reserve),late=rest.filter(z=>z.p[0]>=2).slice(0,reserve);
  return [...head,...late,...rest.filter(z=>!late.includes(z))].slice(0,size);
}
function parisMinutes(){const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).map(x=>[x.type,x.value]));return Number(p.hour)*60+Number(p.minute)}
function attemptOf(source,r){return {source,status:r?.status||"ERROR",httpStatus:r?.httpStatus||0,checkedAt:r?.checkedAt||new Date().toISOString(),lookupCodeType:r?.lookupCodeType||"",lookupDesignator:r?.lookupDesignator||"",...(r?.detailsInfo?{detailsInfo:r.detailsInfo}:{})}}

async function applyOne(env,row,{dryRun=false,recheck=false}={}){let fr24Id="";let base={};try{base=JSON.parse(row.data_json||"{}")}catch{}const f=normalizeFlight(row,base),at=new Date().toISOString(),attempts=[],map={};let needs=needFromCurrent(base),fsIdFound="";if(recheck)needs=Object.fromEntries(Object.keys(needs).map(k=>[k,true]));
  // FlightStats: seulement si un champ gate-time/status manque.
  if(anyNeed(needs,["atd","eta","ata","status"])){const fs=await fetchHtmlSource("FLIGHTSTATS",f);attempts.push(attemptOf("FLIGHTSTATS",fs));map.FLIGHTSTATS=fs?.semantic||{};if(/^\d+$/.test(clean(fs?.flightId)))fsIdFound=clean(fs.flightId)}
  // Tableau des départs FR24 de CDG (lecture en lot, mise en cache) : heure de départ réelle, immatriculation, type, identifiant FR24.
  needs={...needs,gate:!gateValue(base)||/FR24BOARD/.test(upper(base.gateSource)),etd:!clean(base.atd)&&!clean(base.takeoff)};
  if(anyNeed(needs,["atd","reg","aircraft","gate","etd"])){const bl=await boardLookup(f).catch(()=>null);if(bl){attempts.push(bl.attempt);map.FR24BOARD=bl.semantic;needs={...needs,atd:needs.atd&&!bl.semantic.atd,reg:needs.reg&&!bl.semantic.reg,aircraft:needs.aircraft&&!bl.semantic.aircraft,gate:false,etd:false};if(bl.fr24Id&&!clean(f.raw?.fr24OccurrenceId))f.raw={...f.raw,fr24OccurrenceId:bl.fr24Id}}}
  // FR24: seulement pour les faits trajectoire/appareil ou ETA/status manquants.
  needs={...needs,atd:needs.atd&&!clean(map.FLIGHTSTATS?.atd),eta:needs.eta&&!clean(map.FLIGHTSTATS?.eta),ata:needs.ata&&!clean(map.FLIGHTSTATS?.ata),status:needs.status&&!clean(map.FLIGHTSTATS?.status)};
  if(anyNeed(needs,["atd","takeoff","landing","eta","status","aircraft","reg"])){const fr=await fetchFr24Public(f).catch(()=>null);attempts.push({source:"FR24",status:fr?.status||"ERROR",checkedAt:new Date().toISOString()});fr24Id=clean(fr?.candidates?.fr24OccurrenceId);map.FR24=fr24Semantic(fr,f)}
  // FlightAware (generic) only when no departure fact was found at all.
  let faUrl="";
  const noDeparture=!clean(base.atd)&&!clean(base.takeoff)&&!clean(map.FR24?.atd)&&!clean(map.FR24?.takeoff)&&!clean(map.FLIGHTSTATS?.atd);
  // Departed flight still without landing / ATA after FR24 + FlightStats: read its known FlightAware page (PC5038 case).
  const noArrival=!clean(base.ata)&&!clean(base.landing)&&!clean(map.FR24?.ata)&&!clean(map.FR24?.landing)&&!clean(map.FLIGHTSTATS?.ata);
  if(noDeparture||(noArrival&&clean(base.flightAwareHistoryUrl))){
    const fa=await fetchFlightAwareLive(f,base.flightAwareHistoryUrl).catch(()=>null);
    attempts.push({source:"FLIGHTAWARE",status:fa?.status||"ERROR",checkedAt:new Date().toISOString()});
    if(fa?.semantic)map.FLIGHTAWAREEXACT=fa.semantic;
    if(fa?.url)faUrl=fa.url;
  }
  // PlaneFinder puis Skyscanner uniquement si quelque chose reste réellement à compléter.
  for(const source of ["PLANEFINDER","SKYSCANNER"]){const found={atd:choose(map,"atd",LIVE_PUBLIC_SOURCE_ORDER.atd).value,eta:choose(map,"eta",LIVE_PUBLIC_SOURCE_ORDER.eta).value,ata:choose(map,"ata",LIVE_PUBLIC_SOURCE_ORDER.ata).value,status:choose(map,"status",LIVE_PUBLIC_SOURCE_ORDER.status).value,aircraft:choose(map,"aircraft",LIVE_PUBLIC_SOURCE_ORDER.aircraft).value,reg:choose(map,"reg",LIVE_PUBLIC_SOURCE_ORDER.reg).value};const n=needFromCurrent(base),left=(n.atd&&!found.atd)||(n.eta&&!found.eta)||(n.ata&&!found.ata)||(n.status&&!found.status)||(n.aircraft&&!found.aircraft)||(n.reg&&!found.reg);if(!left)break;const r=await fetchHtmlSource(source,f);attempts.push(attemptOf(source,r));map[source]=r?.semantic||{}}
  const current=await readCurrent(env,row.identity);if(!current)return {flight:f.designator,status:"FLIGHT_DISAPPEARED"};let changed=false;
  if(fsIdFound&&(clean(current.flightStatsId)!==fsIdFound||clean(current.flightStatsIdDate)!==f.date)){current.flightStatsId=fsIdFound;current.flightStatsIdDate=f.date;changed=true}
  // An ATD that is just the FR24 takeoff copied over is removed so FlightStats / FlightAware can supply the real gate departure.
  if(clean(current.atd)&&clean(current.atd)===clean(current.takeoff)&&/FR24/.test(upper(current.atdSource))&&!manual(current,"atd")){delete current.atd;delete current.atdSource;delete current.atdUpdatedAt;delete current.atdConfirmed;delete current.atdSources;changed=true}
  // Cleans an "aircraft change" earlier read from the flight number itself (LY320 -> 320).
  {const num=upper(f.number||""),bad=v=>num&&/^[0-9A-Z]{3}$/.test(num)&&upper(v)===num;if(bad(current.aircraftActual)||bad(current.aircraftActualRaw)||bad(current.aircraftChange?.to)){delete current.aircraftActual;delete current.aircraftActualRaw;delete current.aircraftActualSource;delete current.aircraftChange;changed=true}}
  // The exact FR24 occurrence found once is kept on the flight: the next runs read its playback directly.
  if(fr24Id&&!clean(current.fr24OccurrenceId)){current.fr24OccurrenceId=fr24Id;changed=true}
  if(faUrl&&clean(current.flightAwareHistoryUrl)!==faUrl){current.flightAwareHistoryUrl=faUrl;changed=true}
  // A diversion is only believed when two sources agree (FlightStats showed "Diverted to CDG" for SQ337 while FR24 and FlightAware had it en route to SIN).
  const diverted=Object.values(map).filter(v=>clean(v?.status)==="DÉROUTÉ").length>=2;
  // Contradiction: FR24 has the flight airborne (departure fact, no landing) while another source claims a landing / ATA (SQ337: FlightStats "actual arrival 00:59"). The arrival facts are dropped.
  const fr=map.FR24||{},airborneFr24=clean(fr.status)==="EN VOL"&&(clean(fr.atd)||clean(fr.takeoff))&&!clean(fr.ata)&&!clean(fr.landing);
  if(diverted||airborneFr24)for(const [k,v] of Object.entries(map)){if(v&&(diverted||k!=="FR24")){delete v.ata;delete v.landing}}
  // ETD du tableau FR24 (vol pas encore parti) : rempli s'il manque, rafraîchi quand il vient de cette source ou date de plus de 15 min (le retard évolue). Jamais si ATD/décollage connus ou saisie manuelle.
  {const e=clean(map.FR24BOARD?.etd),from=clean(current.etd||current.edt),own=/FR24BOARD/.test(upper(current.etdSource)),stale=Date.now()-(Date.parse(current.etdUpdatedAt||0)||0)>15*60000;
   if(e&&!clean(current.atd)&&!clean(current.takeoff)&&!manual(current,"etd")&&from!==e&&(!from||own||stale)){const log=Array.isArray(current.flightInfoLog)?current.flightInfoLog:[];log.unshift({at,source:"PUBLIC_LIVE:FR24BOARD",field:"etd",from,to:e});current.flightInfoLog=log.slice(0,240);current.etd=e;current.edt=e;current.etdSource="PUBLIC_LIVE:FR24BOARD";current.etdUpdatedAt=at;current.etdTimeBasis="CDG_LOCAL";changed=true}}
  // Porte du tableau FR24 : remplie si elle manque, et suivie ensuite tant que c'est cette source qui l'a écrite (une porte venant d'une autre source ou saisie à la main n'est pas touchée).
  {const g=upper(map.FR24BOARD?.gate),from=gateValue(current);if(g&&!manual(current,"gate")&&from!==g&&(!from||/FR24BOARD/.test(upper(current.gateSource)))){const log=Array.isArray(current.flightInfoLog)?current.flightInfoLog:[];log.unshift({at,source:"PUBLIC_LIVE:FR24BOARD",field:"gate",from,to:g});current.flightInfoLog=log.slice(0,240);current.gate=g;current.gateSource="PUBLIC_LIVE:FR24BOARD";current.gateUpdatedAt=at;changed=true}}
  const atd=choose(map,"atd",LIVE_PUBLIC_SOURCE_ORDER.atd),takeoff=choose(map,"takeoff",LIVE_PUBLIC_SOURCE_ORDER.takeoff),eta=choose(map,"eta",LIVE_PUBLIC_SOURCE_ORDER.eta),landing=choose(map,"landing",LIVE_PUBLIC_SOURCE_ORDER.landing),ata=choose(map,"ata",LIVE_PUBLIC_SOURCE_ORDER.ata),reg=choose(map,"reg",LIVE_PUBLIC_SOURCE_ORDER.reg),ac=choose(map,"aircraft",LIVE_PUBLIC_SOURCE_ORDER.aircraft);
  if(setField(current,"atd",atd,at))changed=true;if(setField(current,"takeoff",takeoff,at))changed=true;if(setField(current,"eta",eta,at))changed=true;if(setField(current,"landing",landing,at))changed=true;let ataHit=ata;if(!ataHit.value&&!clean(current.ata)){const d=deriveAta(landing.value||current.landing,AIRPORT_TZ[upper(f.destination)]||"",f.airline);if(d)ataHit=d}if(setField(current,"ata",ataHit,at))changed=true;if(setField(current,"reg",reg,at))changed=true;if(ac.value&&!manual(current,"aircraft")&&noteActualAircraft(current,ac.value,`PUBLIC_LIVE:${ac.source}`,at))changed=true;
  // Confirmation: stored on each time field (xxxConfirmed + xxxSources); read by the diagnostic and the admin.
  const conf={};for(const [field,hit] of [["atd",atd],["takeoff",takeoff],["eta",eta],["landing",landing],["ata",ataHit]]){if(!clean(current[field])||clean(current[field])!==clean(hit?.value))continue;const c=confirmation(map,field,hit.value);if(current[field+"Confirmed"]!==c.confirmed||clean(current[field+"Sources"])!==c.sources.join(",")){current[field+"Confirmed"]=c.confirmed;current[field+"Sources"]=c.sources.join(",");changed=true}conf[field]=c}
  const explicit=pickStatus(map,LIVE_PUBLIC_SOURCE_ORDER.status);let nextStatus=explicit.value||flightOperationalStatus(current);if(clean(current.ata))nextStatus="ARRIVÉE";else if(clean(current.landing))nextStatus="ATTERI";else if(clean(current.takeoff)||clean(current.atd))nextStatus="EN VOL";nextStatus=diverted?"DÉROUTÉ":guardAirborneStatus(nextStatus,current);
  // A stored cancellation stays unless real actual times exist; a failed fetch (403) or a stray FR24 "EN VOL" must not reset it.
  if(clean(current.status)==="ANNULÉ"&&nextStatus!=="ANNULÉ"&&!clean(current.atd)&&!clean(current.takeoff)&&!clean(current.landing)&&!clean(current.ata))nextStatus="ANNULÉ";// An ANNULÉ already stored (written before cancelledSource existed) gets its marker too, otherwise the status model rewrites it.
  if(nextStatus==="ANNULÉ"&&!clean(current.cancelledSource)&&!manual(current,"status")){current.cancelledSource=explicit.source||"PUBLIC_LIVE";changed=true}
  if(nextStatus&&!manual(current,"status")&&clean(current.status)!==nextStatus){current.status=nextStatus;if(nextStatus==="ANNULÉ")current.cancelledSource=explicit.source||"PUBLIC_LIVE";else delete current.cancelledSource;current.statusSource=explicit.value?`PUBLIC_LIVE:${explicit.source}`:"PUBLIC_LIVE:DERIVED";current.statusUpdatedAt=at;changed=true}
  if(recheck){current.dailyCheckDate=parisDate();changed=true}
  current.publicLiveBackfill={checkedAt:at,mode:"OPTIMIZED_ACTIVE_SOURCES",attempts,fr24OccurrenceId:clean(f.raw?.fr24OccurrenceId)||null};/* The reading itself (attempts, time of check) is always saved, even when no value changed: otherwise a flight whose sources refuse keeps its old check time, comes back first in every cron pass and starves the others, and ADMIN shows stale diagnostics. */if(!dryRun)await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(current),row.identity).run();
  const out={flight:f.designator,status:changed?"UPDATED":"UNCHANGED",attempts};
  if(dryRun){const keys=["atd","atdConfirmed","atdSources","takeoff","takeoffConfirmed","eta","etaConfirmed","landing","ata","ataConfirmed","reg","status","aircraftActual","fr24OccurrenceId","flightAwareHistoryUrl"];out.dryRun=true;out.before=Object.fromEntries(keys.map(k=>[k,base[k]??null]));out.after=Object.fromEntries(keys.map(k=>[k,current[k]??null]));out.sources=Object.fromEntries(Object.entries(map).map(([k,v])=>[k,Object.fromEntries(Object.entries(v||{}).filter(([,x])=>clean(x)))]))}
  return out}

export async function runPublicLiveFlow(env,{limit=12,concurrency=3,recheck=false}={}){if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};const date=parisDate(),startedAt=new Date().toISOString(),nowMin=parisMinutes(),{results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,flight_number,airline,std,data_json FROM flights WHERE flight_date BETWEEN ? AND ? AND airline<>'SYS' ORDER BY flight_date,std,flight_number`).bind(addDaysIso(date,-1),date).all();const scored=results.map(r=>{let x={};try{x=JSON.parse(r.data_json||"{}")}catch{}return {r,x,p:priority(r,x,minutesOnFlightDay(r.flight_date,date,nowMin))}}).filter(z=>z.r.flight_date===date?!(clean(z.x.ata)&&clean(z.x.reg||z.x.registration)&&clean(z.x.aircraftActual||z.x.aircraft)):!clean(z.x.ata)).sort((a,b)=>a.p[0]-b.p[0]||a.p[1]-b.p[1]),size=Math.max(1,Math.min(36,Number(limit)||12)),rest=recheck?results.map(r=>{let x={};try{x=JSON.parse(r.data_json||"{}")}catch{}return {r,x}}).filter(z=>clean(z.x.dailyCheckDate)!==date):[],picked=(recheck?rest.slice(0,size):pickSlots(scored,size)).map(z=>z.r),out=await mapLimit(picked,Math.max(1,Math.min(5,Number(concurrency)||3)),r=>applyOne(env,r,{recheck})),summary={ok:true,mode:recheck?"DAILY_RECHECK":"PUBLIC_LIVE_OPTIMIZED",remaining:recheck?Math.max(0,rest.length-picked.length):undefined,date,startedAt,finishedAt:new Date().toISOString(),checked:picked.length,updated:out.filter(x=>x.status==="UPDATED").length,sourceOrder:LIVE_PUBLIC_SOURCE_ORDER,disabledAutomatic:["FlightView","Wego","Ixigo","Kayak","Flightera","FlightAware generic"],statusCounts:{}};for(const r of out)summary.statusCounts[r.status]=(summary.statusCounts[r.status]||0)+1;if(!recheck)await saveMeta(env,summary);return {...summary,results:out}}
export async function publicLiveStatus(env){let last=null;try{const r=await env.OPS_DB.prepare(`SELECT v FROM ops_meta WHERE k='v2_public_live_last'`).first();if(r?.v)last=JSON.parse(r.v)}catch{}return {ok:true,cadenceMinutes:2,sources:LIVE_PUBLIC_SOURCE_ORDER,disabledAutomatic:["FlightView","Wego","Ixigo","Kayak","Flightera","FlightAware generic"],lastRun:last}}

// One flight, on demand: what the live flow would read and write for it, and where it stands in the ranking of the run.
// dryRun=true (GET) writes nothing; dryRun=false (POST) applies it like a cron run would.
export async function runLiveForFlight(env,{date="",flight="",dryRun=true,limit=18}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const day=clean(date)||parisDate(),wanted=upper(flight).replace(/\s+/g,"");if(!wanted)return {ok:false,error:"flight required"};
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,flight_number,airline,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS' ORDER BY std,flight_number`).bind(day).all();
  const nowMin=parisMinutes(),todayParis=parisDate(),scored=results.map(r=>{let x={};try{x=JSON.parse(r.data_json||"{}")}catch{}return {r,x,p:priority(r,x,minutesOnFlightDay(r.flight_date,todayParis,nowMin))}}).filter(z=>!(clean(z.x.ata)&&clean(z.x.reg||z.x.registration)&&clean(z.x.aircraftActual||z.x.aircraft))).sort((a,b)=>a.p[0]-b.p[0]||a.p[1]-b.p[1]);
  const target=results.find(r=>upper(r.flight_number).replace(/\s+/g,"")===wanted);if(!target)return {ok:false,error:"FLIGHT_NOT_FOUND",date:day,flight:wanted};
  const picked=pickSlots(scored,Math.max(1,Math.min(36,Number(limit)||18))).map(z=>z.r.identity),rank=scored.findIndex(z=>z.r.identity===target.identity),entry=scored[rank];
  let x={};try{x=JSON.parse(target.data_json||"{}")}catch{}
  const result=await applyOne(env,target,{dryRun});
  return {ok:true,date:day,flight:wanted,nowParisMinutes:nowMin,candidates:scored.length,rank:rank<0?null:rank+1,tier:entry?entry.p[0]:null,inNextRun:picked.includes(target.identity),stored:{std:x.std||null,atd:x.atd||null,takeoff:x.takeoff||null,landing:x.landing||null,ata:x.ata||null,status:x.status||null,reg:x.reg||null,lastCheck:x.publicLiveBackfill?.checkedAt||null,lastAttempts:x.publicLiveBackfill?.attempts||null},result};
}
