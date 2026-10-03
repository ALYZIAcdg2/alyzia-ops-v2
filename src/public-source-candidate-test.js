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

function inspect(source,text,httpStatus){
  const u=upper(text),out={};
  if(blocked(text))return {status:"BLOCKED",fields:out};
  if(httpStatus<200||httpStatus>=300)return {status:`HTTP_${httpStatus||0}`,fields:out};
  if(!text||text.length<120)return {status:"NO_CONTENT",fields:out};

  if(source==="KUPI"){
    out.flight=first(text,[/\b([A-Z0-9]{2,3}\s?\d{1,4})\b/]);
    out.terminal=first(text,[/\bTerminal\s*([123][A-Z]?)\b/i,/\bT([123])\b/i]);
    out.gate=first(text,[/\bGate\s*([A-Z]?\d{1,3})\b/i]);
    out.status=first(text,[/\b(Departed|Delayed|Cancelled|Canceled|Boarding|Scheduled|On time)\b/i]);
    out.actualDeparture=first(text,[/Departed at\s*(\d{1,2}:\d{2})/i]);
    out.estimatedDeparture=first(text,[/(?:Estimated|Expected)[^0-9]{0,25}(\d{1,2}:\d{2})/i]);
  } else if(source==="FLIGHT_VIZ"){
    out.status=first(text,[/\b(active|airborne|landed|scheduled|delayed|cancelled|canceled)\b/i]);
    out.aircraft=first(text,[/\b(A20N|A21N|A319|A320|A321|A332|A333|A339|A350|A359|A380|B738|B77W|B788|B789|BCS1|BCS3)\b/i]);
    out.eta=first(text,[/(?:estimated landing|estimated arrival|ETA)[^0-9]{0,25}(\d{1,2}:\d{2})/i]);
  } else if(source==="FLIGHTRADAR_LIVE"){
    out.status=first(text,[/\b(scheduled|active|landed late|landed|cancelled|canceled|unknown)\b/i]);
    out.flight=first(text,[/\b([A-Z0-9]{2,3}\s?\d{1,4})\b/]);
  } else if(source==="EASEMYTRIP"){
    out.status=first(text,[/\b(on time|delayed|cancelled|canceled|departed|arrived|scheduled)\b/i]);
    out.estimated=first(text,[/Estimated[^0-9]{0,30}(\d{1,2}:\d{2})/i]);
    out.scheduled=first(text,[/Scheduled[^0-9]{0,30}(\d{1,2}:\d{2})/i]);
  }
  const fieldCount=Object.values(out).filter(Boolean).length;
  return {status:fieldCount?"OK":"NO_USABLE_DATA",fields:out};
}

async function fetchOne(def,date){
  const url=def.url(date),at=new Date().toISOString(),c=new AbortController(),timer=setTimeout(()=>c.abort(),8000);
  try{
    const r=await fetch(url,{redirect:"follow",signal:c.signal,headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-CandidateSourceTest/1.0)"}});
    const raw=await r.text(),text=textOnly(raw),result=inspect(def.key,text,r.status);
    return {source:def.key,label:def.label,url:r.url||url,httpStatus:r.status,checkedAt:at,status:result.status,fields:result.fields,contentLength:text.length};
  }catch(e){return {source:def.key,label:def.label,url,checkedAt:at,status:e?.name==="AbortError"?"TIMEOUT":"FETCH_ERROR",httpStatus:0,error:String(e?.message||e).slice(0,160),fields:{},contentLength:0}}
  finally{clearTimeout(timer)}
}

export async function runPublicSourceCandidateTest({date}={}){
  const d=clean(date)||new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const results=await Promise.all(CANDIDATE_PUBLIC_SOURCES.map(def=>fetchOne(def,d)));
  return {ok:true,date:d,mode:"ISOLATED_CANDIDATE_TEST",activeCycle:false,results};
}
