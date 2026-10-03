import {fetchFr24Public} from "./fr24-public-html.js";
import {withIcaoFallback,matchesFlightStatsOccurrence,publicPageStatus} from "./public-flight-alias.js";
import {flightOperationalStatus} from "./flight-operational-status.js";
import {AIRPORT_TZ} from "./airport-tz.js";
import {noteActualAircraft} from "./aircraft-change.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const missing=v=>!clean(v)||["—","-","N/A","NULL"].includes(upper(v));
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})/);return m?`${String(Number(m[1])).padStart(2,"0")}:${m[2]}`:""};
const mins=v=>{const t=hhmm(v);if(!t)return null;const [h,m]=t.split(":").map(Number);return h*60+m};
const addMinutes=(v,d)=>{const n=mins(v);if(n==null)return "";const x=(n+Number(d)+1440)%1440;return `${String(Math.floor(x/60)).padStart(2,"0")}:${String(x%60).padStart(2,"0")}`};
const parisDate=()=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const manual=(x,field)=>upper(x?.[field+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[field]||x?.manualOverrides?.[field]||x?.manual_fields?.[field]);
const EXACT_FR24={
  "LO334|2026-10-03":"41f2d8d9",
  "RJ120|2026-10-03":"41f2da8b",
  "TK1830|2026-10-03":"41f2d733",
  "AV55|2026-10-03":"41f30e95",
  "HF177|2026-10-03":"41f31243",
  "SQ335|2026-10-03":"41f35170",
  "HU718|2026-10-03":"41f38aae",
  "VF12|2026-10-03":"41f3a1d1",
  "SM3778|2026-10-03":"41f44e42",
  "VF10|2026-10-03":"41f48b45",
  "VF516|2026-10-03":"41f490f9",
  "TK1834|2026-10-03":"41f49d19",
  "AH1215|2026-10-03":"41f4d035",
  "NH216|2026-10-03":"41f4e62f",
  "OZ502|2026-10-03":"41f4ec4d",
  "TK1828|2026-10-03":"41f4f61e",
  "LO336|2026-10-03":"41f4f8fe",
  "SK560|2026-10-03":"41f51360",
  "AH1085|2026-10-03":"41f51d65",
  "BM591|2026-10-03":"41f4f154"
};

export const LIVE_PUBLIC_SOURCE_ORDER={
  atd:["FlightStats","FlightAware","PlaneFinder","Skyscanner","FlightView","Wego","Ixigo","Kayak","Flightera"],
  status:["FlightAware","FR24","FlightStats","PlaneFinder","Skyscanner","FlightView","Wego","Ixigo","Kayak","Flightera"],
  eta:["FlightStats","FlightAware","FR24","PlaneFinder","Skyscanner","FlightView","Wego","Ixigo","Kayak","Flightera"],
  ata:["FlightStats","FlightAware","PlaneFinder","Skyscanner","FlightView","Wego","Ixigo","Kayak","Flightera"],
  takeoff:["FR24","FlightAware","PlaneFinder","FlightStats"],
  landing:["FR24","FlightAware","FlightStats","PlaneFinder"],
  aircraft:["FR24","FlightAware","PlaneFinder","FlightStats","Flightera","Skyscanner"],
  reg:["FR24","FlightAware","PlaneFinder","FlightStats","Flightera","Skyscanner"]
};

const FALLBACKS={
  FLIGHTSTATS:f=>`https://www.flightstats.com/v2/flight-tracker/${encodeURIComponent(f.airline)}/${encodeURIComponent(f.number)}?year=${f.date.slice(0,4)}&month=${Number(f.date.slice(5,7))}&date=${Number(f.date.slice(8,10))}`,
  FLIGHTAWARE:f=>`https://www.flightaware.com/live/flight/${encodeURIComponent(f.designator)}`,
  PLANEFINDER:f=>`https://planefinder.net/data/flight/${encodeURIComponent(f.designator)}`,
  SKYSCANNER:f=>`https://www.skyscanner.net/flight-tracker/${encodeURIComponent(f.designator.toLowerCase())}`,
  FLIGHTVIEW:f=>`https://www.flightview.com/flight-tracker/${encodeURIComponent(f.airline)}/${encodeURIComponent(f.number)}`,
  WEGO:f=>`https://www.wego.com/schedules/${encodeURIComponent(f.designator)}?date=${encodeURIComponent(f.date)}`,
  IXIGO:f=>`https://www.ixigo.com/flight-status/${encodeURIComponent(f.airline.toLowerCase())}-${encodeURIComponent(f.number)}?date=${encodeURIComponent(f.date)}`,
  KAYAK:f=>`https://www.kayak.com/tracker/${encodeURIComponent(f.designator)}`,
  FLIGHTERA:f=>`https://www.flightera.net/en/flight/${encodeURIComponent(f.designator)}`
};

function normalizeFlight(row,x){
  const airline=upper(x.airline||row.airline),designator=upper(x.flight||row.flight_number);
  const number=designator.startsWith(airline)?designator.slice(airline.length):String(row.flight_number||"").replace(/^[A-Z0-9]{2,3}(?=\d)/,"");
  const id=EXACT_FR24[`${designator}|${row.flight_date}`]||clean(x.fr24OccurrenceId||x.fr24_occurrence_id);
  return {date:row.flight_date,airline,number,designator,origin:upper(x.origin||"CDG"),destination:upper(x.destination||x.dest||""),std:hhmm(x.std||row.std),raw:{...x,fr24OccurrenceId:id}};
}
function textOnly(html){return String(html||"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/\s+/g," ").trim()}
function around(text,f){const u=upper(text),keys=[upper(f.designator),`${upper(f.airline)} ${upper(f.number)}`];let i=-1;for(const k of keys){i=u.indexOf(k);if(i>=0)break}if(i<0)return String(text||"").slice(0,7000);return String(text||"").slice(Math.max(0,i-3000),Math.min(String(text||"").length,i+9000))}
function normalizeTime(raw){let s=upper(raw).replace(/H/,":");const m=s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);if(!m)return "";let h=Number(m[1]),mi=Number(m[2]);if(mi>59||h>23)return "";if(m[3]){if(h>12||h===0)return "";if(m[3]==="AM"&&h===12)h=0;if(m[3]==="PM"&&h!==12)h+=12}return `${String(h).padStart(2,"0")}:${String(mi).padStart(2,"0")}`}
function firstTime(text,patterns){for(const p of patterns){const m=String(text||"").match(p);if(m){const v=normalizeTime(m[1]);if(v)return v}}return ""}
function registration(text){return upper((String(text||"").match(/\b(F-[A-Z]{4}|TC-[A-Z]{3}|TS-[A-Z]{3}|SU-[A-Z]{3}|CC-[A-Z]{3}|9V-[A-Z]{3}|9M-[A-Z]{3}|EI-[A-Z]{3}|SP-[A-Z]{3}|YU-[A-Z]{3}|LZ-[A-Z]{3}|9XR-[A-Z]{2,3}|N\d{1,5}[A-Z]{0,2}|[A-Z]{1,2}-[A-Z]{3,5})\b/i)||[])[1]||"")}
function aircraft(text){return upper((String(text||"").match(/\b(A20N|A21N|A319|A320|A321|A332|A333|A339|A343|A350|A359|A380|B38M|B39M|B737|B738|B739|B748|B752|B753|B763|B764|B772|B773|B77W|B788|B789|BCS1|BCS3|32B|32Q|77W|788|789|359|333|332|320|321)\b/i)||[])[1]||"")}
function statusValue(text){const s=upper(text);if(/CANCEL|ANNUL/.test(s))return "ANNULÉ";if(/ARRIVED AT GATE|ARRIVÉE|ARRIVED\b/.test(s))return "ARRIVÉE";if(/LANDED|ATTERI/.test(s))return "ATTERI";if(/IN AIR|AIRBORNE|IN FLIGHT|EN VOL|EN ROUTE|DEPARTED/.test(s))return "EN VOL";if(/DELAY|RETARD/.test(s))return "RETARDÉ";if(/ON TIME|SCHEDULED|PRÉVU|PREVU/.test(s))return "PRÉVU";return ""}
function semanticText(source,text,f){
  const w=around(text,f),out={};
  if(source==="FLIGHTSTATS"){
    const dep=String(text).split("Flight Departure Times")[1]?.split("Flight Arrival Times")[0]||w;
    const arr=String(text).split("Flight Arrival Times")[1]||w;
    out.atd=firstTime(dep,[/\bActual\b[^0-9]{0,35}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i,/Actual Departure[^0-9]{0,35}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i]);
    out.eta=firstTime(arr,[/\bEstimated\b[^0-9]{0,35}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i,/Estimated Arrival[^0-9]{0,35}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i]);
    out.ata=firstTime(arr,[/\bActual\b[^0-9]{0,35}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i,/Actual Arrival[^0-9]{0,35}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i]);
  }else{
    out.atd=firstTime(w,[/(?:gate departure|gate out|left gate|actual departure|ATD|départ porte)[^0-9]{0,40}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i]);
    out.takeoff=firstTime(w,[/(?:takeoff|take-off|took off|wheels up|airborne|décollage)[^0-9]{0,40}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i]);
    out.eta=firstTime(w,[/(?:estimated gate arrival|estimated arrival|arrival estimate|ETA|arrivée estimée)[^0-9]{0,40}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i]);
    out.landing=firstTime(w,[/(?:landing|landed at|touchdown|wheels down|atterrissage)[^0-9]{0,40}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i]);
    out.ata=firstTime(w,[/(?:gate arrival|gate in|arrived at gate|actual arrival|ATA|arrivée réelle)[^0-9]{0,40}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i]);
  }
  out.status=statusValue(w);out.aircraft=aircraft(w);out.reg=registration(w);return out;
}
function routeMatched(text,f){const u=upper(text);return (!f.origin||u.includes(f.origin))&&(!f.destination||u.includes(f.destination))}
async function fetchHtmlSource(source,f){
  const build=FALLBACKS[source];if(!build)return {source,status:"NO_SOURCE",semantic:{}};
  return withIcaoFallback(f,build,async candidate=>{
    const url=build(candidate),c=new AbortController(),t=setTimeout(()=>c.abort(),6500),checkedAt=new Date().toISOString();
    try{
      const r=await fetch(url,{redirect:"follow",signal:c.signal,headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-LivePublic/1.0)"}});
      const raw=await r.text(),text=textOnly(raw),mentions=upper(text).includes(upper(candidate.designator))||upper(text).includes(`${upper(candidate.airline)} ${upper(candidate.number)}`);
      let status=publicPageStatus(source,text,r.status,mentions,routeMatched(text,candidate));
      if(status==="OK"&&source==="FLIGHTSTATS"&&!matchesFlightStatsOccurrence(text,{...candidate,date:f.date,origin:f.origin,destination:f.destination}))status="OCCURRENCE_MISMATCH";
      return {source,url:r.url||url,httpStatus:r.status,status,checkedAt,semantic:status==="OK"?semanticText(source,text,candidate):{}};
    }catch(e){return {source,url,status:e?.name==="AbortError"?"TIMEOUT":"FETCH_ERROR",httpStatus:0,checkedAt,semantic:{},error:String(e?.message||e).slice(0,160)}}finally{clearTimeout(t)}
  });
}
function clockFromIso(iso,zone){if(!iso)return "";const d=new Date(iso);if(Number.isNaN(d.getTime()))return "";try{const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:zone||"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d).map(x=>[x.type,x.value]));return `${p.hour}:${p.minute}`}catch{return ""}}
function fr24Semantic(fr,f){const s=fr?.candidates?.semantic||{};return {takeoff:clockFromIso(s.takeoff,"Europe/Paris"),eta:clockFromIso(s.eta,AIRPORT_TZ[f.destination]||"Europe/Paris"),landing:clockFromIso(s.landing,AIRPORT_TZ[f.destination]||"Europe/Paris"),status:statusValue(s.status||fr?.candidates?.statuses?.join(" ")||""),aircraft:upper(s.type||fr?.candidates?.aircraft?.[0]),reg:upper(s.reg||fr?.candidates?.registrations?.[0])}}
function sourceLabel(k){return {FLIGHTSTATS:"FLIGHTSTATS",FLIGHTAWARE:"FLIGHTAWARE",FR24:"FR24",PLANEFINDER:"PLANEFINDER",SKYSCANNER:"SKYSCANNER",FLIGHTVIEW:"FLIGHTVIEW",WEGO:"WEGO",IXIGO:"IXIGO",KAYAK:"KAYAK",FLIGHTERA:"FLIGHTERA"}[k]||k}
function choose(map,field,order){for(const src of order){const key=upper(src).replace(/[^A-Z0-9]/g,"");const hit=map[key]||map[src];const v=clean(hit?.[field]);if(v)return {value:v,source:sourceLabel(key)}}return {value:"",source:""}}
function setField(x,field,hit,at){if(!hit?.value||manual(x,field))return false;const before=clean(x[field]);if(before===hit.value&&upper(x[field+"Source"])===upper(`PUBLIC_LIVE:${hit.source}`))return false;const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:`PUBLIC_LIVE:${hit.source}`,field,from:before,to:hit.value});x.flightInfoLog=log.slice(0,240);x[field]=hit.value;x[field+"Source"]=`PUBLIC_LIVE:${hit.source}`;x[field+"UpdatedAt"]=at;if(field==="reg"){x.registration=hit.value;x.aircraftRegistration=hit.value}return true}
function priority(row,x,nowMin){const std=mins(x.std||row.std),checked=Date.parse(x.publicLiveBackfill?.checkedAt||0)||0;if(clean(x.atd)&&!clean(x.ata))return [0,checked];if(!clean(x.atd)&&std!=null&&std<=nowMin+30)return [1,checked];if(!clean(x.eta)&&clean(x.atd))return [2,checked];if(std!=null&&std<=nowMin+120)return [3,checked];return [4,checked]}
function parisMinutes(){const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).map(x=>[x.type,x.value]));return Number(p.hour)*60+Number(p.minute)}
async function readCurrent(env,id){const r=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE identity=? LIMIT 1`).bind(id).first();if(!r)return null;try{return JSON.parse(r.data_json||"{}")}catch{return {}}}
async function saveMeta(env,data){try{await env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS ops_meta(k TEXT PRIMARY KEY,v TEXT)`).run();await env.OPS_DB.prepare(`INSERT INTO ops_meta(k,v) VALUES('v2_public_live_last',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(JSON.stringify(data)).run()}catch{}}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let n=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{for(;;){const i=n++;if(i>=items.length)return;out[i]=await fn(items[i])}}));return out}

async function applyOne(env,row){let base={};try{base=JSON.parse(row.data_json||"{}")}catch{}const f=normalizeFlight(row,base),at=new Date().toISOString(),attempts=[];
  const [fs,fa,frRaw]=await Promise.all([fetchHtmlSource("FLIGHTSTATS",f),fetchHtmlSource("FLIGHTAWARE",f),fetchFr24Public(f).catch(()=>null)]);
  attempts.push({source:"FLIGHTSTATS",status:fs?.status||"ERROR"},{source:"FLIGHTAWARE",status:fa?.status||"ERROR"},{source:"FR24",status:frRaw?.status||"ERROR"});
  const map={FLIGHTSTATS:fs?.semantic||{},FLIGHTAWARE:fa?.semantic||{},FR24:fr24Semantic(frRaw,f)};
  const needs=()=>({atd:!choose(map,"atd",LIVE_PUBLIC_SOURCE_ORDER.atd).value,eta:!choose(map,"eta",LIVE_PUBLIC_SOURCE_ORDER.eta).value,ata:!choose(map,"ata",LIVE_PUBLIC_SOURCE_ORDER.ata).value,status:!choose(map,"status",LIVE_PUBLIC_SOURCE_ORDER.status).value,aircraft:!choose(map,"aircraft",LIVE_PUBLIC_SOURCE_ORDER.aircraft).value,reg:!choose(map,"reg",LIVE_PUBLIC_SOURCE_ORDER.reg).value});
  for(const source of ["PLANEFINDER","SKYSCANNER","FLIGHTVIEW","WEGO","IXIGO","KAYAK","FLIGHTERA"]){const n=needs();if(!Object.values(n).some(Boolean))break;const r=await fetchHtmlSource(source,f);attempts.push({source,status:r?.status||"ERROR"});map[source]=r?.semantic||{}}
  const current=await readCurrent(env,row.identity);if(!current)return {flight:f.designator,status:"FLIGHT_DISAPPEARED"};let changed=false;
  const atd=choose(map,"atd",LIVE_PUBLIC_SOURCE_ORDER.atd),takeoff=choose(map,"takeoff",LIVE_PUBLIC_SOURCE_ORDER.takeoff),eta=choose(map,"eta",LIVE_PUBLIC_SOURCE_ORDER.eta),landing=choose(map,"landing",LIVE_PUBLIC_SOURCE_ORDER.landing),ata=choose(map,"ata",LIVE_PUBLIC_SOURCE_ORDER.ata),reg=choose(map,"reg",LIVE_PUBLIC_SOURCE_ORDER.reg),ac=choose(map,"aircraft",LIVE_PUBLIC_SOURCE_ORDER.aircraft);
  if(setField(current,"atd",atd,at))changed=true;if(setField(current,"takeoff",takeoff,at))changed=true;if(setField(current,"eta",eta,at))changed=true;if(setField(current,"landing",landing,at))changed=true;
  let ataHit=ata;if(!ataHit.value&&/^(E4|ENT)$/.test(upper(f.airline))&&landing.value)ataHit={value:addMinutes(landing.value,10),source:"DERIVED_ENT_LANDING_PLUS_10"};if(setField(current,"ata",ataHit,at)){if(ataHit.source==="DERIVED_ENT_LANDING_PLUS_10"){current.ataDerived=true;current.ataDerivedFrom="landing";current.ataDerivationMinutes=10}changed=true}
  if(reg.value&&!manual(current,"reg")&&upper(current.reg||current.registration)!==upper(reg.value)){if(setField(current,"reg",reg,at))changed=true}
  if(ac.value&&!manual(current,"aircraft")){if(noteActualAircraft(current,ac.value,`PUBLIC_LIVE:${ac.source}`,at))changed=true}
  const explicit=choose(map,"status",LIVE_PUBLIC_SOURCE_ORDER.status);let nextStatus=explicit.value||flightOperationalStatus(current);if(clean(current.ata))nextStatus="ARRIVÉE";else if(clean(current.landing))nextStatus="ATTERI";else if(clean(current.takeoff))nextStatus="EN VOL";
  if(nextStatus&&!manual(current,"status")&&clean(current.status)!==nextStatus){const log=Array.isArray(current.flightInfoLog)?current.flightInfoLog:[];log.unshift({at,source:explicit.value?`PUBLIC_LIVE:${explicit.source}`:"PUBLIC_LIVE:DERIVED",field:"status",from:clean(current.status),to:nextStatus});current.flightInfoLog=log.slice(0,240);current.status=nextStatus;current.statusSource=explicit.value?`PUBLIC_LIVE:${explicit.source}`:"PUBLIC_LIVE:DERIVED";current.statusUpdatedAt=at;changed=true}
  current.publicLiveBackfill={checkedAt:at,attempts,fr24OccurrenceId:clean(f.raw?.fr24OccurrenceId)||null,atd:atd.value||null,takeoff:takeoff.value||null,eta:eta.value||null,landing:landing.value||null,ata:ataHit.value||null,status:nextStatus||null,aircraft:ac.value||null,reg:reg.value||null};
  if(changed)await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(current),row.identity).run();
  return {flight:f.designator,status:changed?"UPDATED":"UNCHANGED",atd:atd.value||"",atdSource:atd.source||"",takeoff:takeoff.value||"",eta:eta.value||"",landing:landing.value||"",ata:ataHit.value||"",statusValue:nextStatus||"",aircraft:ac.value||"",reg:reg.value||"",attempts};
}

export async function runPublicLiveFlow(env,{limit=12,concurrency=3}={}){if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};const date=parisDate(),startedAt=new Date().toISOString(),nowMin=parisMinutes();const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,flight_number,airline,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS' ORDER BY std,flight_number`).bind(date).all();const ranked=results.map(r=>{let x={};try{x=JSON.parse(r.data_json||"{}")}catch{}return {r,x,p:priority(r,x,nowMin)}}).filter(z=>!(clean(z.x.ata)&&clean(z.x.reg)&&clean(z.x.aircraftActual||z.x.aircraft))).sort((a,b)=>a.p[0]-b.p[0]||a.p[1]-b.p[1]).slice(0,Math.max(1,Math.min(36,Number(limit)||12))).map(z=>z.r);const out=await mapLimit(ranked,Math.max(1,Math.min(5,Number(concurrency)||3)),r=>applyOne(env,r));const summary={ok:true,mode:"PUBLIC_LIVE_ALL_SOURCES",date,startedAt,finishedAt:new Date().toISOString(),checked:ranked.length,updated:out.filter(x=>x.status==="UPDATED").length,sourceOrder:LIVE_PUBLIC_SOURCE_ORDER,statusCounts:{}};for(const r of out)summary.statusCounts[r.status]=(summary.statusCounts[r.status]||0)+1;await saveMeta(env,summary);return {...summary,results:out}}
export async function publicLiveStatus(env){let last=null;try{const r=await env.OPS_DB.prepare(`SELECT v FROM ops_meta WHERE k='v2_public_live_last'`).first();if(r?.v)last=JSON.parse(r.v)}catch{}return {ok:true,cadenceMinutes:5,sources:LIVE_PUBLIC_SOURCE_ORDER,lastRun:last}}
