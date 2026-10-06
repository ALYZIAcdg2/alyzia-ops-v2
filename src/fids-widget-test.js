// Diagnostic LECTURE SEULE du widget FIDS flightradar.live (CDG départs). N'écrit rien.
// GET /api/admin/fids-widget-test : lit le script du widget, en extrait les adresses de données et teste les 3 premières.
const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const JS_URL="https://fids.flightradar.live/static/js/flight-status-min.js?v=20260525.1";
const PAGE_URL="https://flightradar.live/en/flights/eur/fr/paris-charles-de-gaulle-airport-cdg-departures/";
const clean=v=>String(v??"").replace(/\s+/g," ").trim();
const upper=v=>clean(v).toUpperCase();
const WALL=/just a moment|verify you are human|captcha|access denied|unusual traffic|cf-chl|login/i;

export function extractEndpoints(js){
  const s=String(js||""),out=new Set();
  for(const m of s.matchAll(/["'`]((?:https?:)?\/\/[^"'`\s]+|\/(?:api|widgets?|fids|ajax|data|flights?)[^"'`\s]*)["'`]/gi)){
    const u=m[1];if(/\.(css|png|jpe?g|svg|gif|woff2?|ico)(\?|$)/i.test(u))continue;out.add(u);
  }
  return [...out].slice(0,40);
}
export function keysOf(v,depth=0){
  if(Array.isArray(v))return v.length?{array:v.length,item:keysOf(v[0],depth+1)}:{array:0};
  if(v&&typeof v==="object"){if(depth>3)return "{…}";return Object.fromEntries(Object.entries(v).slice(0,40).map(([k,x])=>[k,keysOf(x,depth+1)]))}
  return typeof v;
}
async function get(fetchImpl,url,accept){
  const r=await fetchImpl(url,{headers:{accept,"user-agent":UA,"accept-language":"fr-FR,fr;q=0.9,en;q=0.8",referer:PAGE_URL},redirect:"follow"});
  return {r,text:await r.text()};
}
export function summariseSchedule(rows){
  const a=Array.isArray(rows)?rows:[],has=k=>a.filter(r=>r&&String(r[k]??"").trim()!=="").length;
  const keys=[...new Set(a.flatMap(r=>Object.keys(r||{})))];
  return {count:a.length,keys,filled:Object.fromEntries(keys.map(k=>[k,has(k)])),withActual:a.filter(r=>String(r?.dep_actual??"").trim()!=="").slice(0,3),sample:a.slice(0,2)};
}
async function probeSchedule(fetchImpl){
  const url="https://fids.flightradar.live/api/schedules/departures/CDG";
  try{
    const p=await get(fetchImpl,url,"application/json,text/plain,*/*");
    let rows=null;try{rows=JSON.parse(p.text)}catch{}
    return {url,httpStatus:p.r.status,contentType:clean(p.r.headers.get("content-type")),bytes:p.text.length,wall:WALL.test(p.text.slice(0,2000)),...(rows?summariseSchedule(rows):{sample:clean(p.text).slice(0,200)})};
  }catch(e){return {url,error:String(e?.message||e).slice(0,120)}}
}
export async function runFidsWidgetTest({fetchImpl=fetch,flight=""}={}){
  const out={ok:true,mode:"FIDS_WIDGET_TEST_NO_WRITE",jsUrl:JS_URL};
  try{
    const {r,text}=await get(fetchImpl,JS_URL,"*/*");
    out.js={httpStatus:r.status,bytes:text.length,wall:WALL.test(text.slice(0,3000))&&text.length<5000};
    if(r.status!==200)return {...out,verdict:"HTTP_"+r.status,sample:clean(text).slice(0,300)};
    const eps=extractEndpoints(text);out.endpoints=eps;
    out.fieldHints=["atd","actual","takeoff","gate","reg","aircraft","status","estimated","scheduled"].filter(k=>new RegExp(k,"i").test(text));
    out.snippets=["api/schedules","flight_type","fetch(","XMLHttpRequest","actual","flight-tracker"].map(k=>{const i=text.indexOf(k);return i<0?null:{key:k,text:text.slice(Math.max(0,i-300),i+500)}}).filter(Boolean);
    out.schedule=await probeSchedule(fetchImpl);
    const fl=upper(flight).replace(/[^A-Z0-9]/g,"");
    if(fl){out.tracker=[];for(const u of [`https://flightradar.live/en/flight-tracker/${fl}/`,`https://fids.flightradar.live/flight-status/${fl}`,`https://fids.flightradar.live/api/flight/${fl}`,`https://fids.flightradar.live/api/schedules/flight/${fl}`]){
      try{const p=await get(fetchImpl,u,"text/html,application/json,*/*");let shape=null;try{shape=keysOf(JSON.parse(p.text))}catch{}
        out.tracker.push({url:u,httpStatus:p.r.status,contentType:clean(p.r.headers.get("content-type")),bytes:p.text.length,wall:WALL.test(p.text.slice(0,2000)),shape,hasActual:/actual|dep_actual|takeoff/i.test(p.text),sample:shape?undefined:clean(p.text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi," ")).slice(0,500)})}
      catch(e){out.tracker.push({url:u,error:String(e?.message||e).slice(0,120)})}}}
    out.probes=[];
    const cands=eps.filter(u=>/api|data|flight|fids/i.test(u)&&!/\.js(\?|$)/i.test(u)).slice(0,3);
    for(const e of cands){
      let u=e.startsWith("//")?"https:"+e:e.startsWith("/")?"https://fids.flightradar.live"+e:e;
      u+= (u.includes("?")?"&":"?")+"iata_code=CDG&flight_type=departures";
      try{
        const p=await get(fetchImpl,u,"application/json,text/plain,*/*");
        let shape=null;try{shape=keysOf(JSON.parse(p.text))}catch{}
        out.probes.push({url:u,httpStatus:p.r.status,contentType:clean(p.r.headers.get("content-type")),bytes:p.text.length,wall:WALL.test(p.text.slice(0,2000)),shape,sample:shape?undefined:clean(p.text).slice(0,200)});
      }catch(e2){out.probes.push({url:u,error:String(e2?.message||e2).slice(0,120)})}
    }
    out.verdict=(out.schedule?.count>0&&!out.schedule.wall)||out.probes.some(p=>p.shape&&!p.wall)?"JSON_TROUVE":(eps.length?"ENDPOINTS_A_VOIR":"RIEN_TROUVE");
    return out;
  }catch(e){return {...out,ok:false,verdict:"ERREUR_RESEAU",error:String(e?.message||e).slice(0,200)}}
}
