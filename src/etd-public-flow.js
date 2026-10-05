import {guardDepartureClock} from "./local-time-guard.js";
import {withIcaoFallback} from "./public-flight-alias.js";
import {fetchFr24Public,utcToLocal} from "./fr24-public-html.js";
import {AIRPORT_TZ} from "./airport-tz.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})/);return m?`${String(Number(m[1])).padStart(2,"0")}:${m[2]}`:""};
const sameClock=(a,b)=>hhmm(a)&&hhmm(a)===hhmm(b);

function parisToday(){return new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function localFromIso(iso,iata){const d=new Date(iso);if(!Number.isFinite(d.getTime()))return "";const zone=AIRPORT_TZ[upper(iata)]||"Europe/Paris";try{const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d).map(x=>[x.type,x.value]));return `${p.hour}:${p.minute}`}catch{return ""}}
function textOnly(html){return String(html||"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim()}
function estimatedDeparture(text){const T="(\\d{1,2}:\\d{2}(?:\\s*(?:AM|PM))?)";const patterns=[new RegExp(`(?:estimated departure|departure estimate|estimated gate departure|departure estimated|départ estimé)[^0-9]{0,50}${T}`,"i"),new RegExp(`\\bETD\\b[^0-9]{0,25}${T}`,"i")];for(const p of patterns){const m=String(text||"").match(p);if(m){const raw=upper(m[1]);const mm=raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/);if(!mm)continue;let h=Number(mm[1]);if(mm[3]==="AM"&&h===12)h=0;if(mm[3]==="PM"&&h!==12)h+=12;return `${String(h).padStart(2,"0")}:${mm[2]}`}}return ""}
function dateTokens(date){const [y,m,d]=String(date||"").split("-");const mon=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][Number(m)-1]||"";return [date,`${d}-${mon}-${y}`,`${Number(d)} ${mon} ${y}`,`${mon} ${Number(d)} ${y}`,`${d}/${m}/${y}`].map(upper)}
function occurrenceMatch(text,f){const u=upper(text);return (u.includes(upper(f.designator))||u.includes(`${upper(f.airline)} ${upper(f.number)}`))&&u.includes(upper(f.origin))&&u.includes(upper(f.destination))&&dateTokens(f.date).some(t=>u.includes(t))}
async function page(name,url,f){const c=new AbortController(),timer=setTimeout(()=>c.abort(),6000);try{const r=await fetch(url,{redirect:"follow",signal:c.signal,headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-ETD/1.1)"}});const text=textOnly(await r.text());if(!r.ok)return {source:name,status:"HTTP_ERROR"};if(!occurrenceMatch(text,f))return {source:name,status:"OCCURRENCE_MISMATCH"};const etd=estimatedDeparture(text);return {source:name,status:etd?"OK":"NO_ETD",etd}}catch(e){return {source:name,status:e?.name==="AbortError"?"TIMEOUT":"FETCH_ERROR"}}finally{clearTimeout(timer)}}
function reader(name,build){return f=>withIcaoFallback(f,build,x=>page(name,build(x),x))}

// FR24 pages read by the Worker are rendered in UTC: a time found in their text is UTC, converted here to the local clock of the origin.
const localFromUtcText=(clock,f)=>{const c=hhmm(clock);return c?utcToLocal(c,f.date,AIRPORT_TZ[upper(f.origin)]||"Europe/Paris"):""};
async function fr24(f){
  const r=await fetchFr24Public(f);
  const semanticIso=r?.candidates?.semantic?.etd;
  let etd=semanticIso?localFromIso(semanticIso,f.origin):"";
  if(!etd)etd=localFromUtcText(estimatedDeparture(r?.candidates?.excerpt||""),f);
  if(etd&&!sameClock(etd,f.std))return {source:"FR24",status:"OK",etd};
  const history=await page("FR24",`https://www.flightradar24.com/data/flights/${encodeURIComponent(f.designator.toLowerCase())}`,f);
  if(history.status==="OK")history.etd=localFromUtcText(history.etd,f);
  if(history.status==="OK"&&!sameClock(history.etd,f.std))return history;
  const status=(etd&&sameClock(etd,f.std))||(history.status==="OK"&&sameClock(history.etd,f.std))?"ETD_EQUALS_STD":history.status;
  return {source:"FR24",status,etd:""};
}
const paris=reader("PARIS_AEROPORT",()=>"https://www.parisaeroport.fr/en/passengers/flights/all-flights-departures");
const flightStats=reader("FLIGHTSTATS",f=>`https://www.flightstats.com/v2/flight-tracker/${encodeURIComponent(f.airline)}/${encodeURIComponent(f.number)}?year=${f.date.slice(0,4)}&month=${Number(f.date.slice(5,7))}&date=${Number(f.date.slice(8,10))}`);
const flightAware=reader("FLIGHTAWARE",f=>`https://www.flightaware.com/live/flight/${encodeURIComponent(f.designator)}`);
const planeFinder=reader("PLANEFINDER",f=>`https://planefinder.net/data/flight/${encodeURIComponent(f.designator)}`);
const skyscanner=reader("SKYSCANNER",f=>`https://www.skyscanner.net/flight-tracker/${encodeURIComponent(f.designator.toLowerCase())}`);
const flightView=reader("FLIGHTVIEW",f=>`https://www.flightview.com/flight-tracker/${encodeURIComponent(f.airline)}/${encodeURIComponent(f.number)}`);
const wego=reader("WEGO",f=>`https://www.wego.com/schedules/${encodeURIComponent(f.designator)}?date=${encodeURIComponent(f.date)}`);
const ixigo=reader("IXIGO",f=>`https://www.ixigo.com/flight-status/${encodeURIComponent(f.airline.toLowerCase())}-${encodeURIComponent(f.number)}?date=${encodeURIComponent(f.date)}`);
const kayak=reader("KAYAK",f=>`https://www.kayak.com/tracker/${encodeURIComponent(f.designator)}`);
const flightera=reader("FLIGHTERA",f=>`https://www.flightera.net/en/flight/${encodeURIComponent(f.designator)}`);
const flighty=reader("FLIGHTY",()=>"https://flighty.com/airports/paris-charles-de-gaulle-cdg/departures");
const fr24fr=reader("FLIGHTRADARS24_FR",()=>"https://flightradars24.fr/aeroport-charles-de-gaulle/depart/");
const simpleFlying=reader("SIMPLEFLYING",()=>"https://simpleflying.com/flight-tracker/");

export const ETD_PUBLIC_SOURCE_ORDER=["FR24","Paris Aéroport","FlightStats","FlightAware","PlaneFinder","Skyscanner","FlightView","Wego","Ixigo","Kayak","Flightera","Flighty","Flightradars24.fr","SimpleFlying"];
const READERS=[fr24,paris,flightStats,flightAware,planeFinder,skyscanner,flightView,wego,ixigo,kayak,flightera,flighty,fr24fr,simpleFlying];
export async function fetchEtd(f){const attempts=[];for(const r of READERS){const x=await r(f);attempts.push({source:x.source,status:x.status});if(x.status==="OK"&&hhmm(x.etd)&&!sameClock(x.etd,f.std))return {...x,attempts}}return {status:"NO_USABLE_ETD",etd:"",attempts}}

async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{for(;;){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i],i)}}));return out}
async function readCurrent(env,identity){const row=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE identity=? LIMIT 1`).bind(identity).first();if(!row)return null;let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}return x}
function makeFlight(row,x){const std=hhmm(x.std||row.std);const airline=upper(x.airline||row.airline||String(row.flight_number).match(/^[A-Z0-9]{2,3}/)?.[0]||"");const number=String(row.flight_number||"").replace(new RegExp(`^${airline}`,"i"),"");return {date:row.flight_date,designator:upper(x.flight||row.flight_number),airline,number,origin:upper(x.origin||"CDG"),destination:upper(x.destination||x.dest||""),std,raw:x}}
async function saveLastRun(env,data){try{await env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS ops_meta(k TEXT PRIMARY KEY,v TEXT)`).run();await env.OPS_DB.prepare(`INSERT INTO ops_meta(k,v) VALUES('v2_etd_public_last',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(JSON.stringify(data)).run()}catch{}}

async function apply(env,row){
  let initial={};try{initial=JSON.parse(row.data_json||"{}")}catch{}
  if(hhmm(initial.atd)||hhmm(initial.takeoff))return {flight:row.flight_number,status:"STOP_ATD"};
  const f=makeFlight(row,initial);if(!f.std)return {flight:f.designator,status:"NO_STD"};
  const hit=await fetchEtd(f);
  const current=await readCurrent(env,row.identity);if(!current)return {flight:f.designator,status:"FLIGHT_DISAPPEARED"};
  if(hhmm(current.atd)||hhmm(current.takeoff))return {flight:f.designator,status:"STOP_ATD"};
  if(hit.status!=="OK"){
    current.etdBackfill={checkedAt:new Date().toISOString(),status:hit.status,attempts:hit.attempts||[]};
    await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(current),row.identity).run();
    return {flight:f.designator,status:hit.status,attempts:hit.attempts||[]};
  }
  // Local clock of the origin: a public page rendered in UTC gives an ETD hours before the STD.
  {const g=guardDepartureClock(hit.etd,f.std,f.date,AIRPORT_TZ[upper(f.origin)]||"Europe/Paris");if(g.status==="REJECTED")return {flight:f.designator,status:"ETD_NOT_LOCAL",etd:hit.etd};hit.etd=g.value}
  if(sameClock(hit.etd,f.std))return {flight:f.designator,status:"ETD_EQUALS_STD"};
  const at=new Date().toISOString(),from=hhmm(current.etd||current.edt);
  current.etd=hit.etd;current.edt=hit.etd;current.etdSource=`PUBLIC_ETD:${hit.source}`;current.etdUpdatedAt=at;current.etdTimeBasis="CDG_LOCAL";current.etdBackfill={checkedAt:at,status:"OK",source:hit.source,attempts:hit.attempts||[]};
  const log=Array.isArray(current.flightInfoLog)?current.flightInfoLog:[];log.unshift({at,source:`PUBLIC_ETD:${hit.source}`,field:"etd",from,to:hit.etd});current.flightInfoLog=log.slice(0,200);
  await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(current),row.identity).run();
  return {flight:f.designator,status:from===hit.etd?"UNCHANGED":"UPDATED",etd:hit.etd,source:hit.source};
}

export async function runEtdPublicFlow(env,{concurrency=6}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const date=parisToday(),startedAt=new Date().toISOString();
  // During the first 6 hours after midnight (Paris) the flights of yesterday that have not departed yet (late evening delays, ETD after midnight) are read too.
  const pp=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).map(x=>[x.type,x.value])),early=Number(pp.hour)<6,from=(()=>{const t=new Date(`${date}T12:00:00Z`);t.setUTCDate(t.getUTCDate()-(early?1:0));return t.toISOString().slice(0,10)})();
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,flight_number,airline,std,data_json FROM flights WHERE flight_date BETWEEN ? AND ? AND airline<>'SYS' ORDER BY flight_date,std,flight_number`).bind(from,date).all();
  const candidates=results.filter(row=>{let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}return !hhmm(x.atd)&&!hhmm(x.takeoff)&&Boolean(hhmm(x.std||row.std))});
  const out=await mapLimit(candidates,Math.max(1,Math.min(8,Number(concurrency)||6)),row=>apply(env,row));
  const summary={ok:true,date,startedAt,finishedAt:new Date().toISOString(),total:results.length,checked:candidates.length,updated:out.filter(x=>x.status==="UPDATED").length,unchanged:out.filter(x=>x.status==="UNCHANGED").length,stoppedAtd:results.length-candidates.length,statusCounts:{}};
  for(const r of out)summary.statusCounts[r.status]=(summary.statusCounts[r.status]||0)+1;
  await saveLastRun(env,summary);return {...summary,results:out};
}

export async function etdPublicStatus(env){let last=null;try{const r=await env.OPS_DB.prepare(`SELECT v FROM ops_meta WHERE k='v2_etd_public_last'`).first();if(r?.v)last=JSON.parse(r.v)}catch{}return {ok:true,cadenceMinutes:2,sources:ETD_PUBLIC_SOURCE_ORDER,lastRun:last}}
