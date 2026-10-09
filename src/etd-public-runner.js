import {fetchEtd,ETD_PUBLIC_SOURCE_ORDER} from "./etd-public-flow.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})/);return m?`${String(Number(m[1])).padStart(2,"0")}:${m[2]}`:""};
const mins=v=>{const t=hhmm(v);if(!t)return null;const [h,m]=t.split(":").map(Number);return h*60+m};
const diff=(a,b)=>{const x=mins(a),y=mins(b);if(x==null||y==null)return 999;const d=Math.abs(x-y);return Math.min(d,1440-d)};
function parisToday(){return new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function utcClockToParis(date,time){const t=hhmm(time);if(!t)return "";const d=new Date(`${date}T${t}:00Z`);if(!Number.isFinite(d.getTime()))return "";const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d).map(x=>[x.type,x.value]));return `${p.hour}:${p.minute}`}
function normalizeSourceTime(hit,f){let t=hhmm(hit?.etd);if(!t)return "";if(upper(hit?.source)!=="FR24")return t;const converted=utcClockToParis(f.date,t);if(!converted)return t;return diff(converted,f.std)<diff(t,f.std)?converted:t}
function flightNumberOnly(airline,flight){const a=upper(airline),f=upper(flight);return f.startsWith(a)?f.slice(a.length):f.replace(/^[A-Z0-9]{2,3}(?=\d)/,"")}
function makeFlight(row,x){const airline=upper(x.airline||row.airline),number=flightNumberOnly(airline,x.flight||row.flight_number);return {date:row.flight_date,designator:upper(x.flight||row.flight_number),airline,number,origin:upper(x.origin||"CDG"),destination:upper(x.destination||x.dest||""),std:hhmm(x.std||row.std),raw:x}}
async function readCurrent(env,id){const r=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE identity=? LIMIT 1`).bind(id).first();if(!r)return null;try{return JSON.parse(r.data_json||"{}")}catch{return {}}}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{for(;;){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i])}}));return out}
async function saveLastRun(env,data){try{await env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS ops_meta(k TEXT PRIMARY KEY,v TEXT)`).run();await env.OPS_DB.prepare(`INSERT INTO ops_meta(k,v) VALUES('v2_etd_public_last',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(JSON.stringify(data)).run()}catch{}}

async function apply(env,row){
  let initial={};try{initial=JSON.parse(row.data_json||"{}")}catch{}
  if(hhmm(initial.atd)||hhmm(initial.takeoff))return {flight:row.flight_number,status:"STOP_ATD"};
  const f=makeFlight(row,initial);if(!f.std)return {flight:f.designator,status:"NO_STD"};
  const hit=await fetchEtd(f);
  if(hit.status!=="OK")return {flight:f.designator,status:hit.status,attempts:hit.attempts||[]};
  const etd=normalizeSourceTime(hit,f);if(!etd||etd===f.std)return {flight:f.designator,status:"ETD_EQUALS_STD"};
  const current=await readCurrent(env,row.identity);if(!current)return {flight:f.designator,status:"FLIGHT_DISAPPEARED"};
  if(hhmm(current.atd)||hhmm(current.takeoff))return {flight:f.designator,status:"STOP_ATD"};
  const from=hhmm(current.etd||current.edt);
  if(/FIDS|FR24BOARD/.test(upper(current.etdSource))&&from)return {flight:f.designator,status:"FIDS_PRIORITY",etd:from};
  if(from===etd&&upper(current.etdSource)===`PUBLIC_ETD:${upper(hit.source)}`&&current.etdTimeBasis==="CDG_LOCAL")return {flight:f.designator,status:"UNCHANGED",etd,source:hit.source};
  const at=new Date().toISOString();current.etd=etd;current.edt=etd;current.etdSource=`PUBLIC_ETD:${hit.source}`;current.etdUpdatedAt=at;current.etdTimeBasis="CDG_LOCAL";current.etdBackfill={checkedAt:at,status:"OK",source:hit.source,attempts:hit.attempts||[]};
  const log=Array.isArray(current.flightInfoLog)?current.flightInfoLog:[];if(from!==etd)log.unshift({at,source:`PUBLIC_ETD:${hit.source}`,field:"etd",from,to:etd});current.flightInfoLog=log.slice(0,200);
  await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(current),row.identity).run();
  return {flight:f.designator,status:from===etd?"UNCHANGED":"UPDATED",etd,source:hit.source};
}

export async function runEtdPublicFlowSafe(env,{concurrency=6}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};const date=parisToday(),startedAt=new Date().toISOString();
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,flight_number,airline,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS' ORDER BY std,flight_number`).bind(date).all();
  const candidates=results.filter(row=>{let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}return !hhmm(x.atd)&&!hhmm(x.takeoff)&&Boolean(hhmm(x.std||row.std))});
  const out=await mapLimit(candidates,Math.max(1,Math.min(8,Number(concurrency)||6)),r=>apply(env,r));
  const summary={ok:true,date,startedAt,finishedAt:new Date().toISOString(),total:results.length,checked:candidates.length,updated:out.filter(x=>x.status==="UPDATED").length,unchanged:out.filter(x=>x.status==="UNCHANGED").length,stoppedAtd:results.length-candidates.length,statusCounts:{}};for(const r of out)summary.statusCounts[r.status]=(summary.statusCounts[r.status]||0)+1;await saveLastRun(env,summary);return {...summary,results:out}
}
export async function etdPublicStatusSafe(env){let last=null;try{const r=await env.OPS_DB.prepare(`SELECT v FROM ops_meta WHERE k='v2_etd_public_last'`).first();if(r?.v)last=JSON.parse(r.v)}catch{}return {ok:true,cadenceMinutes:2,sources:ETD_PUBLIC_SOURCE_ORDER,lastRun:last}}
