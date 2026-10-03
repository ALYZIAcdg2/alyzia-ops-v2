import {fetchFr24Public} from "./fr24-public-html.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})/);return m?`${String(Number(m[1])).padStart(2,"0")}:${m[2]}`:""};
function parisToday(){return new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function flightNumberOnly(airline,flight){const a=upper(airline),f=upper(flight);return f.startsWith(a)?f.slice(a.length):f.replace(/^[A-Z0-9]{2,3}(?=\d)/,"")}
function textOnly(html){return String(html||"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim()}
function setLogged(x,field,value,source,at){const next=clean(value),before=clean(x[field]);if(!next||before===next)return false;x[field]=next;x[field+"Source"]=source;x[field+"UpdatedAt"]=at;const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source,field,from:before,to:next});x.flightInfoLog=log.slice(0,200);return true}
function makeFlight(row,x){const airline=upper(x.airline||row.airline),number=flightNumberOnly(airline,x.flight||row.flight_number),designator=upper(x.flight||`${airline}${number}`);return {date:row.flight_date,airline,number,designator,origin:upper(x.origin||x.dep||"CDG"),destination:upper(x.destination||x.dest||"")}}
async function readCurrent(env,identity){const row=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE identity=? LIMIT 1`).bind(identity).first();if(!row)return null;try{return JSON.parse(row.data_json||"{}")}catch{return {}}}
async function fetchParisGate(f){
  const url="https://www.parisaeroport.fr/en/passengers/flights/all-flights-departures";
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
  try{
    const r=await fetch(url,{redirect:"follow",signal:controller.signal,headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-GATE/1.0)"}});
    const body=await r.text();if(!r.ok)return {source:"PARIS_AEROPORT",status:"HTTP_ERROR",gate:""};
    const raw=textOnly(body),u=upper(raw),keys=[f.designator,`${f.airline} ${f.number}`].map(upper);let idx=-1;for(const k of keys){idx=u.indexOf(k);if(idx>=0)break}if(idx<0)return {source:"PARIS_AEROPORT",status:"FLIGHT_NOT_FOUND",gate:""};
    const scoped=raw.slice(Math.max(0,idx-500),Math.min(raw.length,idx+1600));
    for(const p of [/(?:gate|porte)\s*[:\-]?\s*([A-Z]?\d{1,3}[A-Z]?)/i,/\b([A-Z]\d{1,3}[A-Z]?)\b\s*(?:gate|porte)/i]){const m=scoped.match(p);if(m)return {source:"PARIS_AEROPORT",status:"OK",gate:upper(m[1])}}
    return {source:"PARIS_AEROPORT",status:"NO_GATE",gate:""};
  }catch(e){return {source:"PARIS_AEROPORT",status:e?.name==="AbortError"?"TIMEOUT":"FETCH_ERROR",gate:""}}finally{clearTimeout(timer)}
}
async function fetchFr24Fields(f){
  const r=await fetchFr24Public(f),c=r?.candidates||{},s=c.semantic||{};
  const type=upper(s.type||(Array.isArray(c.aircraft)?c.aircraft[0]:""));
  const reg=upper(s.reg||(Array.isArray(c.registrations)?c.registrations[0]:""));
  const gate=upper(s.gateOrigin||(Array.isArray(c.gates)?c.gates[0]:""));
  return {source:"FR24",status:(type||reg||gate)?"OK":clean(r?.status)||"NO_DATA",type,reg,gate};
}
async function applyOne(env,row){
  let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
  const f=makeFlight(row,x),at=new Date().toISOString();
  const paris=await fetchParisGate(f);
  const fr24=await fetchFr24Fields(f);
  const current=await readCurrent(env,row.identity);if(!current)return {flight:f.designator,status:"FLIGHT_DISAPPEARED"};
  let changed=false;
  const gate=paris.gate||fr24.gate;if(gate)changed=setLogged(current,"gate",gate,paris.gate?"PARIS_AEROPORT":"FR24",at)||changed;
  if(fr24.type){changed=setLogged(current,"aircraftActual",fr24.type,"FR24",at)||changed;changed=setLogged(current,"type",fr24.type,"FR24",at)||changed}
  if(fr24.reg){changed=setLogged(current,"reg",fr24.reg,"FR24",at)||changed;current.registration=fr24.reg}
  if(changed)await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(current),row.identity).run();
  return {flight:f.designator,status:changed?"UPDATED":"UNCHANGED",gate:gate||"",type:fr24.type||"",reg:fr24.reg||"",gateSource:paris.gate?"PARIS_AEROPORT":gate?"FR24":"",parisStatus:paris.status,fr24Status:fr24.status};
}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{for(;;){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i],i)}}));return out}
async function saveLastRun(env,data){try{await env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS ops_meta(k TEXT PRIMARY KEY,v TEXT)`).run();await env.OPS_DB.prepare(`INSERT INTO ops_meta(k,v) VALUES('v2_gate_aircraft_public_last',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(JSON.stringify(data)).run()}catch{}}
export async function runGateAircraftPublicFlow(env,{concurrency=6}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};const date=parisToday(),startedAt=new Date().toISOString();
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,flight_number,airline,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS' ORDER BY std,flight_number`).bind(date).all();
  const out=await mapLimit(results,Math.max(1,Math.min(8,Number(concurrency)||6)),row=>applyOne(env,row));
  const summary={ok:true,mode:"GATE_TYPE_REG_PUBLIC_15M",date,startedAt,finishedAt:new Date().toISOString(),checked:results.length,updated:out.filter(x=>x.status==="UPDATED").length,results:out};await saveLastRun(env,summary);return summary;
}
export async function gateAircraftPublicStatus(env){let last=null;try{const r=await env.OPS_DB.prepare(`SELECT v FROM ops_meta WHERE k='v2_gate_aircraft_public_last'`).first();if(r?.v)last=JSON.parse(r.v)}catch{}return {ok:true,cadenceMinutes:15,gatePrimary:"PARIS_AEROPORT",typePrimary:"FR24",registrationPrimary:"FR24",lastRun:last}}
