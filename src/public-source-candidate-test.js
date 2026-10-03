const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})/);return m?`${String(Number(m[1])).padStart(2,"0")}:${m[2]}`:""};
const blocked=t=>/just a moment|attention required|verify you are human|access denied|unusual traffic|cf-chl|captcha|incapsula/i.test(t);
const textOnly=html=>String(html||"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/\s+/g," ").trim();
const first=(text,patterns)=>{for(const p of patterns){const m=String(text||"").match(p);if(m)return clean(m[1]||m[0])}return ""};

export const CANDIDATE_PUBLIC_SOURCES=Object.freeze([
  {key:"KUPI",label:"Kupi",url:d=>`https://www.kupi.com/en/explore/france/paris/charles-de-gaulle-airport/timetable?date=${d}&direction=departure&time=all`},
  {key:"FLIGHT_VIZ",label:"Flight-Viz",url:()=>"https://flight-viz.com/"},
  {key:"FLIGHTRADAR_LIVE",label:"Flightradar.live",url:()=>"https://flightradar.live/en/flights/eur/fr/paris-charles-de-gaulle-airport-cdg-departures/"},
  {key:"EASEMYTRIP",label:"EaseMyTrip",url:()=>"https://www.easemytrip.com/flights/flight-status/"}
]);

function flightVariants(flight){
  const f=upper(flight).replace(/\s+/g,"");
  const m=f.match(/^([A-Z0-9]{2,3})(\d{1,4}[A-Z]?)$/);
  if(!m)return f?[f]:[];
  return [...new Set([f,`${m[1]} ${m[2]}`])];
}
function exactWindow(text,flight){
  const s=String(text||""),u=upper(s),vars=flightVariants(flight);
  for(const v of vars){const i=u.indexOf(upper(v));if(i>=0)return {matched:true,text:s.slice(Math.max(0,i-900),Math.min(s.length,i+1900)),variant:v}}
  return {matched:false,text:"",variant:""};
}
function inspect(source,text,httpStatus,{flight="",destination=""}={}){
  const out={};
  if(blocked(text))return {status:"BLOCKED",fields:out,matchedFlight:false};
  if(httpStatus<200||httpStatus>=300)return {status:`HTTP_${httpStatus||0}`,fields:out,matchedFlight:false};
  if(!text||text.length<120)return {status:"NO_CONTENT",fields:out,matchedFlight:false};

  const wanted=upper(flight).replace(/\s+/g,"");
  const hit=wanted?exactWindow(text,wanted):{matched:false,text:"",variant:""};
  if(wanted&&!hit.matched)return {status:"ACCESS_OK_NO_FLIGHT_MATCH",fields:out,matchedFlight:false};
  const scope=hit.matched?hit.text:text;
  if(destination&&hit.matched&&!upper(scope).includes(upper(destination)))return {status:"ROUTE_MISMATCH",fields:out,matchedFlight:true,matchedVariant:hit.variant};

  if(source==="KUPI"){
    out.flight=hit.variant||wanted;
    out.terminal=first(scope,[/\bTerminal\s*([123][A-Z]?)\b/i,/\bT([123])\b/i]);
    out.gate=first(scope,[/\bGate\s*([A-Z]?\d{1,3})\b/i]);
    out.status=first(scope,[/\b(Departed|Delayed|Cancelled|Canceled|Boarding|Scheduled|On time)\b/i]);
    out.actualDeparture=first(scope,[/Departed at\s*(\d{1,2}:\d{2})/i,/Actual departure[^0-9]{0,25}(\d{1,2}:\d{2})/i]);
    out.estimatedDeparture=first(scope,[/(?:Estimated|Expected)[^0-9]{0,25}(\d{1,2}:\d{2})/i]);
  } else if(source==="FLIGHT_VIZ"){
    out.flight=hit.variant||wanted;
    out.status=first(scope,[/\b(active|airborne|landed|scheduled|delayed|cancelled|canceled)\b/i]);
    out.aircraft=first(scope,[/\b(A20N|A21N|A319|A320|A321|A332|A333|A339|A350|A359|A380|B738|B77W|B788|B789|BCS1|BCS3)\b/i]);
    out.eta=first(scope,[/(?:estimated landing|estimated arrival|ETA)[^0-9]{0,25}(\d{1,2}:\d{2})/i]);
  } else if(source==="FLIGHTRADAR_LIVE"){
    out.flight=hit.variant||wanted;
    out.status=first(scope,[/\b(scheduled|active|landed late|landed|cancelled|canceled|unknown)\b/i]);
  } else if(source==="EASEMYTRIP"){
    out.flight=hit.variant||wanted;
    out.status=first(scope,[/\b(on time|delayed|cancelled|canceled|departed|arrived|scheduled)\b/i]);
    out.estimated=first(scope,[/Estimated[^0-9]{0,30}(\d{1,2}:\d{2})/i]);
    out.scheduled=first(scope,[/Scheduled[^0-9]{0,30}(\d{1,2}:\d{2})/i]);
  }
  const meaningful=Object.entries(out).filter(([k,v])=>k!=="flight"&&Boolean(v)).length;
  return {status:meaningful?"OK":"MATCH_NO_USABLE_DATA",fields:out,matchedFlight:hit.matched,matchedVariant:hit.variant||""};
}

async function fetchOne(def,date,opts){
  const url=def.url(date),at=new Date().toISOString(),c=new AbortController(),timer=setTimeout(()=>c.abort(),8000);
  try{
    const r=await fetch(url,{redirect:"follow",signal:c.signal,headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-CandidateSourceTest/1.1)"}});
    const raw=await r.text(),text=textOnly(raw),result=inspect(def.key,text,r.status,opts);
    return {source:def.key,label:def.label,url:r.url||url,httpStatus:r.status,checkedAt:at,status:result.status,matchedFlight:result.matchedFlight,matchedVariant:result.matchedVariant||"",fields:result.fields,contentLength:text.length};
  }catch(e){return {source:def.key,label:def.label,url,checkedAt:at,status:e?.name==="AbortError"?"TIMEOUT":"FETCH_ERROR",httpStatus:0,error:String(e?.message||e).slice(0,160),matchedFlight:false,fields:{},contentLength:0}}
  finally{clearTimeout(timer)}
}

export async function runPublicSourceCandidateTest({date,flight,destination}={}){
  const d=clean(date)||new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const f=upper(flight).replace(/\s+/g,"");
  const dest=upper(destination);
  const results=await Promise.all(CANDIDATE_PUBLIC_SOURCES.map(def=>fetchOne(def,d,{flight:f,destination:dest})));
  return {ok:true,date:d,flight:f||null,destination:dest||null,mode:"ISOLATED_CANDIDATE_TEST",activeCycle:false,results};
}
