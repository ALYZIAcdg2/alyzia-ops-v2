import {withIcaoFallback,matchesFlightStatsOccurrence} from "./public-flight-alias.js";
import {fetchStaFallbacks} from "./sta-public-fallbacks.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const isMissing=v=>!clean(v)||["—","-","N/A","NULL","NON RENSEIGNÉ","NON RENSEIGNE"].includes(upper(v));
const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}});

function parisDate(){
  const p=new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const m=Object.fromEntries(p.map(x=>[x.type,x.value]));
  return `${m.year}-${m.month}-${m.day}`;
}
function nextDate(date){
  const [y,m,d]=String(date).split("-").map(Number);
  const x=new Date(Date.UTC(y,m-1,d+1));
  return x.toISOString().slice(0,10);
}
function flightNumberOnly(airline,flight){
  const a=upper(airline),f=upper(flight);
  if(f.startsWith(a))return f.slice(a.length);
  return f.replace(/^[A-Z0-9]{2,3}(?=\d)/,"");
}
function normalizeRow(row){
  let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
  const airline=upper(x.airline||row.airline);
  const number=flightNumberOnly(airline,x.flight||row.flight_number);
  return {
    identity:row.identity,date:row.flight_date,airline,number,
    designator:`${airline}${number}`,
    origin:upper(x.origin||x.dep||"CDG"),
    destination:upper(x.destination||x.dest),
    x
  };
}
function htmlText(html){
  return String(html||"")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;/g,"'").replace(/&quot;/gi,'"')
    .replace(/\s+/g," ").trim();
}
function to24(raw){
  const s=clean(raw).toUpperCase();
  const m=s.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/);
  if(!m)return "";
  let h=Number(m[1]),min=Number(m[2]);
  if(min>59||h>23)return "";
  if(m[3]){
    if(h<1||h>12)return "";
    if(m[3]==="AM"&&h===12)h=0;
    if(m[3]==="PM"&&h!==12)h+=12;
  }
  return `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}`;
}
export function parseFlightStatsScheduledArrival(text){
  const t=String(text||"");
  const split=t.split(/Flight Arrival Times/i);
  if(split.length<2)return "";
  const section=split.slice(1).join("Flight Arrival Times").slice(0,1600);
  const time="(\\d{1,2}:\\d{2}(?:\\s*(?:AM|PM))?)";
  const patterns=[
    new RegExp(`\\bScheduled\\b(?:\\s+Arrival)?(?:\\s+Time)?[\\s:,-]*${time}`,"i"),
    new RegExp(`${time}[\\sA-Z+0-9:.-]{0,24}\\bScheduled\\b`,"i"),
    new RegExp(`\\bScheduled\\b[\\s\\S]{0,80}?${time}`,"i")
  ];
  for(const p of patterns){
    const m=section.match(p);if(m){const v=to24(m[1]);if(v)return v}
  }
  return "";
}
function flightStatsUrl(f){
  return `https://www.flightstats.com/v2/flight-tracker/${encodeURIComponent(f.airline)}/${encodeURIComponent(f.number)}?year=${f.date.slice(0,4)}&month=${Number(f.date.slice(5,7))}&date=${Number(f.date.slice(8,10))}`;
}
async function readFlightStats(flight){
  const url=flightStatsUrl(flight),checkedAt=new Date().toISOString();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{
    const r=await fetch(url,{redirect:"follow",signal:controller.signal,headers:{
      accept:"text/html,application/xhtml+xml",
      "accept-language":"fr-FR,fr;q=0.9,en;q=0.8",
      "user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-STA-Backfill/1.1; public-web-page)"
    }});
    const body=await r.text(),text=htmlText(body),u=upper(text);
    if(/JUST A MOMENT|ATTENTION REQUIRED|VERIFY YOU ARE HUMAN|ACCESS DENIED|UNUSUAL TRAFFIC/.test(u))return {source:"FLIGHTSTATS_PUBLIC",url,finalUrl:r.url,httpStatus:r.status,status:"BLOCKED",checkedAt};
    if(!r.ok)return {source:"FLIGHTSTATS_PUBLIC",url,finalUrl:r.url,httpStatus:r.status,status:"HTTP_ERROR",checkedAt};
    if(/FLIGHT STATUS NOT AVAILABLE|COULD NOT BE LOCATED IN OUR SYSTEM/.test(u))return {source:"FLIGHTSTATS_PUBLIC",url,finalUrl:r.url,httpStatus:r.status,status:"NOT_TRACKED",checkedAt};
    if(!matchesFlightStatsOccurrence(text,flight))return {source:"FLIGHTSTATS_PUBLIC",url,finalUrl:r.url,httpStatus:r.status,status:"OCCURRENCE_MISMATCH",checkedAt};
    const sta=parseFlightStatsScheduledArrival(text);
    return {source:"FLIGHTSTATS_PUBLIC",url,finalUrl:r.url,httpStatus:r.status,status:sta?"OK":"NO_USABLE_DATA",sta,checkedAt};
  }catch(e){
    return {source:"FLIGHTSTATS_PUBLIC",url,finalUrl:url,httpStatus:0,status:e?.name==="AbortError"?"TIMEOUT":"FETCH_ERROR",error:String(e?.message||e).slice(0,220),checkedAt};
  }finally{clearTimeout(timer)}
}
async function fetchSta(flight){
  const primary=await withIcaoFallback(flight,flightStatsUrl,readFlightStats);
  const attempts=[{source:"FLIGHTSTATS_PUBLIC",status:primary.status,lookupDesignator:primary.lookupDesignator||flight.designator}];
  if(primary.status==="OK"&&/^\d{2}:\d{2}$/.test(clean(primary.sta)))return {...primary,attempts};
  const fallback=await fetchStaFallbacks(flight);
  return {...fallback,attempts:[...attempts,...(fallback.attempts||[])]};
}
async function mapLimit(items,limit,fn){
  const out=new Array(items.length);let next=0;
  const workers=Array.from({length:Math.min(limit,items.length)},async()=>{
    for(;;){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i],i)}
  });
  await Promise.all(workers);return out;
}
async function readScope(env){
  const today=parisDate(),tomorrow=nextDate(today);
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,airline,flight_number,data_json FROM flights WHERE flight_date IN (?,?) AND airline<>'SYS' ORDER BY flight_date,std,flight_number`).bind(today,tomorrow).all();
  const flights=results.map(normalizeRow);
  const missing=flights.filter(f=>isMissing(f.x.sta));
  return {today,tomorrow,flights,missing};
}
async function writeSta(env,flight,result){
  const row=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE identity=? LIMIT 1`).bind(flight.identity).first();
  if(!row)return {changed:false,reason:"FLIGHT_DISAPPEARED"};
  let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
  if(!isMissing(x.sta))return {changed:false,reason:"STA_ALREADY_PRESENT",sta:clean(x.sta)};
  const sta=clean(result?.sta);if(!/^\d{2}:\d{2}$/.test(sta))return {changed:false,reason:"NO_VALID_STA"};
  const at=result.checkedAt||new Date().toISOString();
  const source=clean(result.source)||"PUBLIC_STA_SOURCE";
  x.sta=sta;
  x.staSource=source;
  x.staUpdatedAt=at;
  x.staBackfill={source,lookupDesignator:result.lookupDesignator||flight.designator,url:result.finalUrl||result.url||null,checkedAt:at,attempts:result.attempts||[]};
  const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];
  log.unshift({at,source,field:"sta",from:"",to:sta});x.flightInfoLog=log.slice(0,160);
  await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),flight.identity).run();
  return {changed:true,sta,source};
}
async function saveLastRun(env,data){
  try{
    await env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS ops_meta(k TEXT PRIMARY KEY,v TEXT)`).run();
    await env.OPS_DB.prepare(`INSERT INTO ops_meta(k,v) VALUES('v2_sta_backfill_last',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(JSON.stringify(data)).run();
  }catch(_){}
}
export async function staBackfillStatus(env){
  const scope=await readScope(env);
  let last=null;try{const r=await env.OPS_DB.prepare(`SELECT v FROM ops_meta WHERE k='v2_sta_backfill_last'`).first();if(r?.v)last=JSON.parse(r.v)}catch{}
  return {ok:true,date:scope.today,j1:scope.tomorrow,total:scope.flights.length,missingSta:scope.missing.length,complete:scope.missing.length===0,lastRun:last};
}
export async function runStaBackfill(env,{limit=48,concurrency=4}={}){
  if(!env?.OPS_DB)return {ok:false,error:"OPS_DB_NON_CONFIGURE"};
  const scope=await readScope(env),missingBefore=scope.missing.length,at=new Date().toISOString();
  if(!missingBefore){
    const done={ok:true,mode:"STA_J_J1_PUBLIC_BACKFILL",date:scope.today,j1:scope.tomorrow,total:scope.flights.length,missingBefore:0,attempted:0,filled:0,missingAfter:0,complete:true,checkedAt:at};
    await saveLastRun(env,done);return done;
  }
  const batch=scope.missing.slice(0,Math.max(1,Math.min(96,Number(limit)||48)));
  const results=await mapLimit(batch,Math.max(1,Math.min(8,Number(concurrency)||4)),async flight=>{
    const source=await fetchSta(flight);
    if(source.status!=="OK"||!source.sta)return {identity:flight.identity,flight:flight.designator,status:source.status,changed:false,source:source.source||null,attempts:source.attempts||[]};
    const write=await writeSta(env,flight,source);
    return {identity:flight.identity,flight:flight.designator,status:source.status,lookupDesignator:source.lookupDesignator||flight.designator,attempts:source.attempts||[],...write};
  });
  const after=await readScope(env),filled=results.filter(r=>r.changed).length;
  const summary={ok:true,mode:"STA_J_J1_PUBLIC_BACKFILL",date:scope.today,j1:scope.tomorrow,total:scope.flights.length,missingBefore,attempted:batch.length,filled,missingAfter:after.missing.length,complete:after.missing.length===0,checkedAt:at,statusCounts:{},sourceCounts:{}};
  for(const r of results){
    summary.statusCounts[r.status]=(summary.statusCounts[r.status]||0)+1;
    if(r.changed&&r.source)summary.sourceCounts[r.source]=(summary.sourceCounts[r.source]||0)+1;
  }
  await saveLastRun(env,summary);
  return summary;
}
export async function handleStaBackfill(request,env){
  const url=new URL(request.url);
  if(url.pathname!=="/api/v2/sta-backfill/status")return null;
  if(request.method!=="GET")return json({ok:false,error:"METHOD"},405);
  return json(await staBackfillStatus(env));
}
