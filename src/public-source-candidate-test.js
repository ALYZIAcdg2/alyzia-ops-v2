const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const blocked=t=>/just a moment|attention required|verify you are human|access denied|unusual traffic|cf-chl|captcha|incapsula/i.test(t);
const textOnly=html=>String(html||"").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/\s+/g," ").trim();
const first=(text,patterns)=>{for(const p of patterns){const m=String(text||"").match(p);if(m)return clean(m[1]||m[0])}return ""};
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
const escRe=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

export const CANDIDATE_PUBLIC_SOURCES=Object.freeze([
  {key:"KUPI",label:"Kupi",url:d=>`https://www.kupi.com/en/explore/france/paris/charles-de-gaulle-airport/timetable?date=${d}&direction=departure&time=all`},
  {key:"FLIGHT_VIZ",label:"Flight-Viz",url:()=>"https://flight-viz.com/"},
  {key:"FLIGHTRADAR_LIVE",label:"Flightradar.live",url:()=>"https://flightradar.live/en/flights/eur/fr/paris-charles-de-gaulle-airport-cdg-departures/"},
  {key:"EASEMYTRIP",label:"EaseMyTrip",url:()=>"https://www.easemytrip.com/flights/flight-status/"}
]);

function flightVariants(flight){
  const f=upper(flight).replace(/\s+/g,"");if(!f)return [];
  const m=f.match(/^([A-Z0-9]{2,3})(\d{1,4}[A-Z]?)$/);if(!m)return [f];
  return uniq([f,`${m[1]} ${m[2]}`,`${m[1]}-${m[2]}`]);
}
function findFlight(raw,visible,flight){
  for(const v of flightVariants(flight)){
    const re=new RegExp(`(^|[^A-Z0-9])${escRe(v).replace(/\\ /g,"\\s*")}([^A-Z0-9]|$)`,`i`);
    if(re.test(visible))return {matched:true,variant:v,where:"VISIBLE_TEXT"};
    if(re.test(raw))return {matched:true,variant:v,where:"RAW_HTML_OR_SCRIPT"};
  }
  return {matched:false,variant:"",where:""};
}
function around(text,needle,span=2200){
  if(!needle)return "";const s=String(text||""),i=upper(s).indexOf(upper(needle));if(i<0)return "";return s.slice(Math.max(0,i-span),Math.min(s.length,i+needle.length+span));
}
function discover(raw,baseUrl){
  const scripts=uniq([...String(raw).matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(m=>m[1])).slice(0,20);
  const absolute=uniq([...String(raw).matchAll(/https?:\\?\/\\?\/[^"'<>\s)]+/gi)].map(m=>m[0].replace(/\\\//g,"/"))).filter(u=>/api|flight|airport|status|depart|arriv|track|schedule|timetable/i.test(u));
  const relative=uniq([...String(raw).matchAll(/["'](\/(?:api|ajax|flight|flights|airport|status|track|schedule|timetable)[^"']*)["']/gi)].map(m=>m[1]));
  const forms=uniq([...String(raw).matchAll(/<form\b[^>]*\baction=["']([^"']+)["']/gi)].map(m=>m[1]));
  return {scriptSrcs:scripts,endpointCandidates:uniq([...absolute,...relative,...forms]).slice(0,40),baseUrl};
}
function extractFields(source,scope){
  const out={};
  if(source==="KUPI"){
    out.terminal=first(scope,[/\bTerminal\s*[:\-]?\s*([123][A-Z]?)\b/i,/\bterminal["':=\s]+([123][A-Z]?)/i]);
    out.gate=first(scope,[/\bGate\s*[:\-]?\s*([A-Z]?\d{1,3})\b/i,/\bgate["':=\s]+([A-Z]?\d{1,3})/i]);
    out.status=first(scope,[/\b(Departed|Delayed|Cancelled|Canceled|Boarding|Scheduled|On time|Landed|Arrived)\b/i]);
    out.actualDeparture=first(scope,[/Departed at\s*(\d{1,2}:\d{2})/i,/actual[^0-9]{0,40}(\d{1,2}:\d{2})/i]);
    out.estimatedDeparture=first(scope,[/(?:Estimated|Expected)[^0-9]{0,40}(\d{1,2}:\d{2})/i]);
  }else if(source==="FLIGHT_VIZ"){
    out.status=first(scope,[/\b(active|airborne|landed|scheduled|delayed|cancelled|canceled|arrived|departed)\b/i]);
    out.aircraft=first(scope,[/\b(A20N|A21N|A319|A320|A321|A332|A333|A339|A350|A359|A380|B738|B77W|B788|B789|BCS1|BCS3)\b/i]);
    out.eta=first(scope,[/(?:estimated landing|estimated arrival|ETA)[^0-9]{0,40}(\d{1,2}:\d{2})/i]);
  }else if(source==="FLIGHTRADAR_LIVE"){
    out.status=first(scope,[/\b(scheduled|active|landed late|landed|cancelled|canceled|unknown|departed|arrived|delayed)\b/i]);
    out.time=first(scope,[/\b(\d{1,2}:\d{2})\b/]);
  }else if(source==="EASEMYTRIP"){
    out.status=first(scope,[/\b(on time|delayed|cancelled|canceled|departed|arrived|scheduled|landed)\b/i]);
    out.estimated=first(scope,[/Estimated[^0-9]{0,40}(\d{1,2}:\d{2})/i]);
    out.scheduled=first(scope,[/Scheduled[^0-9]{0,40}(\d{1,2}:\d{2})/i]);
  }
  return out;
}
function inspect(source,raw,httpStatus,{flight="",destination="",baseUrl=""}={}){
  const visible=textOnly(raw),diagnostics=discover(raw,baseUrl);
  if(blocked(raw)||blocked(visible))return {status:"BLOCKED",fields:{},matchedFlight:false,matchedVariant:"",matchLocation:"",diagnostics};
  if(httpStatus<200||httpStatus>=300)return {status:`HTTP_${httpStatus||0}`,fields:{},matchedFlight:false,matchedVariant:"",matchLocation:"",diagnostics};
  if(!raw||raw.length<120)return {status:"NO_CONTENT",fields:{},matchedFlight:false,matchedVariant:"",matchLocation:"",diagnostics};
  const hit=findFlight(raw,visible,flight);
  if(flight&&!hit.matched)return {status:"ACCESS_OK_NO_FLIGHT_MATCH",fields:{},matchedFlight:false,matchedVariant:"",matchLocation:"",diagnostics};
  const scope=hit.matched?(around(raw,hit.variant)||around(visible,hit.variant)):visible;
  if(destination&&hit.matched&&!upper(scope).includes(upper(destination)))return {status:"ROUTE_MISMATCH",fields:{},matchedFlight:true,matchedVariant:hit.variant,matchLocation:hit.where,diagnostics};
  const fields=extractFields(source,scope),meaningful=Object.values(fields).filter(Boolean).length;
  return {status:meaningful?"OK":"MATCH_NO_USABLE_DATA",fields,matchedFlight:hit.matched,matchedVariant:hit.variant||"",matchLocation:hit.where||"",diagnostics};
}

async function fetchOne(def,date,opts){
  const url=def.url(date),at=new Date().toISOString(),c=new AbortController(),timer=setTimeout(()=>c.abort(),8000);
  try{
    const r=await fetch(url,{redirect:"follow",signal:c.signal,headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-CandidateSourceTest/2.0)"}});
    const raw=await r.text(),result=inspect(def.key,raw,r.status,{...opts,baseUrl:r.url||url});
    return {source:def.key,label:def.label,url:r.url||url,httpStatus:r.status,checkedAt:at,status:result.status,matchedFlight:result.matchedFlight,matchedVariant:result.matchedVariant,matchLocation:result.matchLocation,fields:result.fields,contentLength:raw.length,diagnostics:result.diagnostics};
  }catch(e){return {source:def.key,label:def.label,url,checkedAt:at,status:e?.name==="AbortError"?"TIMEOUT":"FETCH_ERROR",httpStatus:0,error:String(e?.message||e).slice(0,160),matchedFlight:false,matchedVariant:"",matchLocation:"",fields:{},contentLength:0,diagnostics:{scriptSrcs:[],endpointCandidates:[],baseUrl:url}}}
  finally{clearTimeout(timer)}
}

export async function runPublicSourceCandidateTest({date,flight,destination}={}){
  const d=clean(date)||new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const f=upper(flight).replace(/\s+/g,""),dest=upper(destination);
  const results=await Promise.all(CANDIDATE_PUBLIC_SOURCES.map(def=>fetchOne(def,d,{flight:f,destination:dest})));
  return {ok:true,date:d,flight:f||null,destination:dest||null,mode:"ISOLATED_CANDIDATE_TEST_V2",activeCycle:false,results};
}
