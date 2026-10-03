import {withIcaoFallback} from "./public-flight-alias.js";
import {fetchFr24Public} from "./fr24-public-html.js";
import {AIRPORT_TZ} from "./airport-tz.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})/);return m?`${String(Number(m[1])).padStart(2,"0")}:${m[2]}`:""};
const toMin=v=>{const h=hhmm(v);if(!h)return null;const [a,b]=h.split(":").map(Number);return a*60+b};
const sameClock=(a,b)=>hhmm(a)&&hhmm(a)===hhmm(b);

function parisToday(){return new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function localFromIso(iso,iata){const d=new Date(iso);if(!Number.isFinite(d.getTime()))return "";const zone=AIRPORT_TZ[upper(iata)]||"Europe/Paris";try{const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d).map(x=>[x.type,x.value]));return `${p.hour}:${p.minute}`}catch{return ""}}
function textOnly(html){return String(html||"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim()}
function estimatedDeparture(text){const T="(\\d{1,2}:\\d{2}(?:\\s*(?:AM|PM))?)";const patterns=[new RegExp(`(?:estimated departure|departure estimate|estimated gate departure|departure estimated|départ estimé)[^0-9]{0,40}${T}`,"i"),new RegExp(`\\bETD\\b[^0-9]{0,20}${T}`,"i")];for(const p of patterns){const m=String(text||"").match(p);if(m){const raw=upper(m[1]);const mm=raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/);if(!mm)continue;let h=Number(mm[1]);if(mm[3]==="AM"&&h===12)h=0;if(mm[3]==="PM"&&h!==12)h+=12;return `${String(h).padStart(2,"0")}:${mm[2]}`}}return ""}
function dateTokens(date){const [y,m,d]=String(date||"").split("-");const mon=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][Number(m)-1]||"";return [date,`${d}-${mon}-${y}`,`${Number(d)} ${mon} ${y}`,`${mon} ${Number(d)} ${y}`,`${d}/${m}/${y}`].map(upper)}
function occurrenceMatch(text,f){const u=upper(text);return (u.includes(upper(f.designator))||u.includes(`${upper(f.airline)} ${upper(f.number)}`))&&u.includes(upper(f.origin))&&u.includes(upper(f.destination))&&dateTokens(f.date).some(t=>u.includes(t))}
async function page(name,url,f){const c=new AbortController(),timer=setTimeout(()=>c.abort(),8500);try{const r=await fetch(url,{redirect:"follow",signal:c.signal,headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-ETD/1.0)"}});const text=textOnly(await r.text());if(!r.ok)return {source:name,status:"HTTP_ERROR"};if(!occurrenceMatch(text,f))return {source:name,status:"OCCURRENCE_MISMATCH"};const etd=estimatedDeparture(text);return {source:name,status:etd?"OK":"NO_ETD",etd}}catch(e){return {source:name,status:e?.name==="AbortError"?"TIMEOUT":"FETCH_ERROR"}}finally{clearTimeout(timer)}}
function reader(name,build){return f=>withIcaoFallback(f,build,x=>page(name,build(x),x))}

async function fr24(f){const r=await fetchFr24Public(f),iso=r?.candidates?.semantic?.etd;let etd=iso?localFromIso(iso,f.origin):"";if(etd&&!sameClock(etd,f.std))return {source:"FR24",status:"OK",etd};const history=await page("FR24",`https://www.flightradar24.com/data/flights/${encodeURIComponent(f.designator.toLowerCase())}`,f);if(history.status==="OK"&&!sameClock(history.etd,f.std))return history;return {source:"FR24",status:history.status==="OK"?"ETD_EQUALS_STD":history.status,etd:""}}
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
const fr24fr=reader("FLIGHTRADARS24_FR",()=>"https://flightradars24.fr/aeroport-charles-de-gaulle/depart/ig");
const simpleFlying=reader("SIMPLEFLYING",()=>"https://simpleflying.com/flight-tracker/");

export const ETD_PUBLIC_SOURCE_ORDER=["FR24","Paris Aéroport","FlightStats","FlightAware","PlaneFinder","Skyscanner","FlightView","Wego","Ixigo","Kayak","Flightera","Flighty","Flightradars24.fr","SimpleFlying"];
const READERS=[fr24,paris,flightStats,flightAware,planeFinder,skyscanner,flightView,wego,ixigo,kayak,flightera,flighty,fr24fr,simpleFlying];
export async function fetchEtd(f){const attempts=[];for(const r of READERS){const x=await r(f);attempts.push({source:x.source,status:x.status});if(x.status==="OK"&&hhmm(x.etd)&&!sameClock(x.etd,f.std))return {...x,attempts}}return {status:"NO_USABLE_ETD",etd:"",attempts}}

async function apply(env,row){let x={};try{x=JSON.parse(row.data_json||"{}")}catch{};if(hhmm(x.atd)||hhmm(x.takeoff))return {flight:row.flight_number,status:"STOP_ATD"};const std=hhmm(x.std||row.std);if(!std)return {flight:row.flight_number,status:"NO_STD"};const airline=upper(x.airline||row.airline||String(row.flight_number).match(/^[A-Z0-9]{2,3}/)?.[0]||"");const number=String(row.flight_number||"").replace(new RegExp(`^${airline}`,"i"),"");const f={date:row.flight_date,designator:upper(row.flight_number),airline,number,origin:upper(x.origin||"CDG"),destination:upper(x.destination||x.dest||""),std,raw:x};const hit=await fetchEtd(f);if(hit.status!=="OK")return {flight:f.designator,status:hit.status};x.etd=hit.etd;x.edt=hit.etd;x.etdSource=`PUBLIC_ETD:${hit.source}`;x.etdUpdatedAt=new Date().toISOString();await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();return {flight:f.designator,status:"UPDATED",etd:hit.etd,source:hit.source}}

export async function runEtdPublicFlow(env){if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};const date=parisToday();const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,flight_number,airline,std,data_json FROM flights WHERE flight_date=? ORDER BY std,flight_number`).bind(date).all();const out=[];for(const row of results){out.push(await apply(env,row))}return {ok:true,date,checked:results.length,updated:out.filter(x=>x.status==="UPDATED").length,stoppedAtd:out.filter(x=>x.status==="STOP_ATD").length,results:out}}
