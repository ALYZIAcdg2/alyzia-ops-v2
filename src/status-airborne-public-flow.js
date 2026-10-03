import {withIcaoFallback,publicPageStatus} from "./public-flight-alias.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const today=()=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const manual=(x,field)=>upper(x?.[field+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[field]||x?.manualOverrides?.[field]||x?.manual_fields?.[field]);

const SOURCES=[
  ["FLIGHTAWARE",f=>`https://www.flightaware.com/live/flight/${encodeURIComponent(f.designator)}`],
  ["PLANEFINDER",f=>`https://planefinder.net/data/flight/${encodeURIComponent(f.designator)}`],
  ["FLIGHTSTATS",f=>`https://www.flightstats.com/v2/flight-tracker/${encodeURIComponent(f.airline)}/${encodeURIComponent(f.number)}?year=${f.date.slice(0,4)}&month=${Number(f.date.slice(5,7))}&date=${Number(f.date.slice(8,10))}`]
];
export const STATUS_AIRBORNE_SOURCE_ORDER=["FlightAware","PlaneFinder","FlightStats"];

function textOnly(html){return String(html||"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/\s+/g," ").trim()}
function normalize(row,x){const airline=upper(x.airline||row.airline),designator=upper(x.flight||row.flight_number),number=designator.startsWith(airline)?designator.slice(airline.length):String(row.flight_number||"").replace(/^[A-Z0-9]{2,3}(?=\d)/,"");return {date:row.flight_date,airline,number,designator,origin:upper(x.origin||"CDG"),destination:upper(x.destination||x.dest||"")}}
function routeOk(text,f){const u=upper(text);return (!f.origin||u.includes(f.origin))&&(!f.destination||u.includes(f.destination))}
function phase(source,text){const s=upper(text);
  if(/CANCEL|ANNUL/.test(s))return "ANNULÉ";
  if(/ARRIVED AT GATE|GATE ARRIVAL|ARRIVÉE(?: À LA PORTE)?|ARRIVED\b/.test(s))return "ARRIVÉE";
  if(/LANDED|TOUCHDOWN|ATTERI|POSÉ|POSE A/.test(s))return "ATTERI";
  if(/IN AIR|AIRBORNE|IN FLIGHT|EN VOL|EN ROUTE|TOOK OFF|WHEELS UP/.test(s))return "EN VOL";
  if(source!=="FLIGHTSTATS"&&/DEPARTED/.test(s))return "PARTI";
  if(source==="FLIGHTSTATS"&&/DEPARTED/.test(s))return "PARTI";
  return "";
}
async function fetchSource(source,build,f){return withIcaoFallback(f,build,async candidate=>{const url=build(candidate),c=new AbortController(),t=setTimeout(()=>c.abort(),6500);try{const r=await fetch(url,{redirect:"follow",signal:c.signal,headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-Status/1.0)"}});const text=textOnly(await r.text()),mentions=upper(text).includes(upper(candidate.designator))||upper(text).includes(`${upper(candidate.airline)} ${upper(candidate.number)}`);const ok=publicPageStatus(source,text,r.status,mentions,routeOk(text,candidate));return {source,status:ok,phase:ok==="OK"?phase(source,text):"",url:r.url||url}}catch(e){return {source,status:e?.name==="AbortError"?"TIMEOUT":"FETCH_ERROR",phase:"",url,error:String(e?.message||e).slice(0,160)}}finally{clearTimeout(t)}})}
function sourceName(s){return s==="FLIGHTAWARE"?"FLIGHTAWARE":s==="PLANEFINDER"?"PLANEFINDER":"FLIGHTSTATS"}

export async function runStatusAirbornePublicFlow(env,{limit=36,concurrency=4}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const date=today(),{results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,flight_number,airline,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS' ORDER BY std,flight_number`).bind(date).all();
  const candidates=[];for(const row of results){let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}if(manual(x,"status")||clean(x.ata))continue;if(!clean(x.atd)&&!clean(x.takeoff))continue;candidates.push({row,x})}
  const chosen=candidates.slice(0,Math.max(1,Math.min(60,Number(limit)||36)));let n=0,updated=0;const items=[];
  await Promise.all(Array.from({length:Math.min(Math.max(1,Number(concurrency)||4),chosen.length||1)},async()=>{for(;;){const i=n++;if(i>=chosen.length)return;const {row,x}=chosen[i],f=normalize(row,x),attempts=[];let hit=null;
    for(const [source,build] of SOURCES){const r=await fetchSource(source,build,f);attempts.push({source,status:r.status,phase:r.phase||""});if(r.phase){hit=r;break}}
    if(!hit){items[i]={flight:f.designator,status:"NO_STATUS",attempts};continue}
    const currentRow=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE identity=? LIMIT 1`).bind(row.identity).first();if(!currentRow){items[i]={flight:f.designator,status:"DISAPPEARED",attempts};continue}let current={};try{current=JSON.parse(currentRow.data_json||"{}")}catch{}if(manual(current,"status")){items[i]={flight:f.designator,status:"MANUAL",attempts};continue}
    const next=hit.phase,before=clean(current.status),src=`PUBLIC_STATUS:${sourceName(hit.source)}`;if(before!==next||upper(current.statusSource)!==src){const at=new Date().toISOString(),log=Array.isArray(current.flightInfoLog)?current.flightInfoLog:[];log.unshift({at,source:src,field:"status",from:before,to:next});current.flightInfoLog=log.slice(0,240);current.status=next;current.statusSource=src;current.statusUpdatedAt=at;current.providerStatusRaw=next;current.providerStatusRawSource=src;await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(current),row.identity).run();updated++;items[i]={flight:f.designator,status:"UPDATED",value:next,source:src,attempts}}else items[i]={flight:f.designator,status:"UNCHANGED",value:next,source:src,attempts}
  }}));
  return {ok:true,date,checked:chosen.length,updated,sourceOrder:STATUS_AIRBORNE_SOURCE_ORDER,fr24UsedForStatus:false,items:items.filter(Boolean)};
}
