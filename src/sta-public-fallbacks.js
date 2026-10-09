import {withIcaoFallback,flightLookupVariants} from "./public-flight-alias.js";
import {fetchFr24Public} from "./fr24-public-html.js";
import {AIRPORT_TZ} from "./airport-tz.js";
import {guardedFetch} from "./fs-guard.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();

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
function dateTokens(date){
  const [y,m,d]=String(date||"").split("-");
  const months=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const mon=months[Number(m)-1]||"",day=String(Number(d||0));
  return [date,`${d}-${mon}-${y}`,`${day} ${mon} ${y}`,`${mon} ${day} ${y}`,`${d}/${m}/${y}`,`${m}/${d}/${y}`].filter(Boolean).map(upper);
}
function flightMatches(text,flight){
  const u=upper(text);
  return flightLookupVariants(flight).some(v=>u.includes(upper(v.designator))||u.includes(`${upper(v.airline)} ${upper(v.number)}`));
}
function routeScopedText(text,flight,{before=420,after=900}={}){
  const raw=String(text||""),u=upper(raw),dest=upper(flight.destination),origin=upper(flight.origin);
  if(!dest||!origin)return "";
  const re=new RegExp(`\\b${dest.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'g');
  let m;
  while((m=re.exec(u))){
    const scope=raw.slice(Math.max(0,m.index-before),Math.min(raw.length,m.index+after));
    const su=upper(scope);
    if(!new RegExp(`\\b${origin}\\b`).test(su))continue;
    if(!dateTokens(flight.date).some(t=>su.includes(t)))continue;
    if(!flightMatches(scope,flight))continue;
    return scope;
  }
  return "";
}
export function occurrenceMatchesStaPage(text,flight){
  return Boolean(routeScopedText(text,flight));
}
export function parsePublicScheduledArrival(text){
  const t=String(text||""),time="(\\d{1,2}:\\d{2}(?:\\s*(?:AM|PM))?)";
  const patterns=[
    new RegExp(`\\bScheduled\\b[\\s\\S]{0,90}?\\bArrival\\b[\\s:,-]{0,20}${time}`,"i"),
    new RegExp(`\\bArrival\\b[\\s\\S]{0,90}?\\bScheduled\\b[\\s:,-]{0,20}${time}`,"i"),
    new RegExp(`\\bScheduled arrival\\b[\\s:,-]{0,20}${time}`,"i"),
    new RegExp(`\\bArrival time\\b[\\s\\S]{0,50}?\\bScheduled\\b[\\s:,-]{0,20}${time}`,"i"),
    new RegExp(`\\bSTA\\b[\\s:,-]{0,16}${time}`,"i")
  ];
  for(const p of patterns){const m=t.match(p);if(m){const v=to24(m[1]);if(v)return v}}
  return "";
}
async function fetchPage(name,url,flight){
  const checkedAt=new Date().toISOString(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{
    const r=await guardedFetch(url,{redirect:"follow",signal:controller.signal,headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-STA-Fallback/1.3; public-web-page)"}});
    const body=await r.text(),text=htmlText(body),u=upper(text);
    if(/JUST A MOMENT|ATTENTION REQUIRED|VERIFY YOU ARE HUMAN|ACCESS DENIED|UNUSUAL TRAFFIC/.test(u))return {source:name,status:"BLOCKED",url,finalUrl:r.url,httpStatus:r.status,checkedAt};
    if(!r.ok)return {source:name,status:"HTTP_ERROR",url,finalUrl:r.url,httpStatus:r.status,checkedAt};
    if(/FLIGHT NOT FOUND|UNKNOWN FLIGHT|NO HISTORY DATA|FLIGHT STATUS NOT AVAILABLE/.test(u))return {source:name,status:"NOT_TRACKED",url,finalUrl:r.url,httpStatus:r.status,checkedAt};
    const scope=routeScopedText(text,flight);
    if(!scope)return {source:name,status:"OCCURRENCE_MISMATCH",url,finalUrl:r.url,httpStatus:r.status,checkedAt};
    const sta=parsePublicScheduledArrival(scope);
    return {source:name,status:sta?"OK":"NO_USABLE_DATA",sta,url,finalUrl:r.url,httpStatus:r.status,checkedAt};
  }catch(e){return {source:name,status:e?.name==="AbortError"?"TIMEOUT":"FETCH_ERROR",url,finalUrl:url,httpStatus:0,error:String(e?.message||e).slice(0,220),checkedAt}}
  finally{clearTimeout(timer)}
}
function pageReader(name,buildUrl){return flight=>withIcaoFallback(flight,buildUrl,f=>fetchPage(name,buildUrl(f),f))}

const flightAware=pageReader("FLIGHTAWARE_PUBLIC",f=>`https://www.flightaware.com/live/flight/${encodeURIComponent(f.designator)}`);
const planeFinder=pageReader("PLANEFINDER_PUBLIC",f=>`https://planefinder.net/data/flight/${encodeURIComponent(f.designator)}`);
const skyscanner=pageReader("SKYSCANNER_PUBLIC",f=>`https://www.skyscanner.net/flight-tracker/${encodeURIComponent(f.designator.toLowerCase())}`);
const flightView=pageReader("FLIGHTVIEW_PUBLIC",f=>`https://www.flightview.com/flight-tracker/${encodeURIComponent(f.airline)}/${encodeURIComponent(f.number)}`);
const wego=pageReader("WEGO_PUBLIC",f=>`https://www.wego.com/schedules/${encodeURIComponent(f.designator)}?date=${encodeURIComponent(f.date)}`);
const ixigo=pageReader("IXIGO_PUBLIC",f=>`https://www.ixigo.com/flight-status/${encodeURIComponent(f.airline.toLowerCase())}-${encodeURIComponent(f.number)}?date=${encodeURIComponent(f.date)}`);
const kayak=pageReader("KAYAK_PUBLIC",f=>`https://www.kayak.com/tracker/${encodeURIComponent(f.designator)}`);
const flightera=pageReader("FLIGHTERA_PUBLIC",f=>`https://www.flightera.net/en/flight/${encodeURIComponent(f.designator)}`);
const flighty=pageReader("FLIGHTY_PUBLIC",()=>`https://flighty.com/airports/paris-charles-de-gaulle-cdg/departures`);
const parisAeroport=pageReader("PARIS_AEROPORT_PUBLIC",()=>`https://www.parisaeroport.fr/en/passengers/flights/all-flights-departures`);
const simpleFlying=pageReader("SIMPLEFLYING_PUBLIC",()=>`https://simpleflying.com/flight-tracker/`);
const flightradars24fr=pageReader("FLIGHTRADARS24_FR_PUBLIC",()=>`https://flightradars24.fr/aeroport-charles-de-gaulle/depart/`);

function localFromIso(iso,iata){
  const d=new Date(iso);if(!Number.isFinite(d.getTime()))return "";
  const zone=AIRPORT_TZ[upper(iata)]||"Europe/Paris";
  try{const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d).map(x=>[x.type,x.value]));return `${parts.hour}:${parts.minute}`}catch{return ""}
}
function localFromUtcClock(date,clock,iata){const hh=to24(clock);return hh?localFromIso(`${date}T${hh}:00Z`,iata):""}
async function fr24Exact(flight){
  const r=await fetchFr24Public(flight),c=r?.candidates||{},staIso=c?.semantic?.sta;
  const exact=Boolean(c?.method==="PUBLIC_PLAYBACK"&&c?.occurrenceMatched&&staIso);
  return {source:"FR24_PUBLIC_EXACT",status:exact?"OK":(r?.status||"NO_USABLE_DATA"),sta:exact?localFromIso(staIso,flight.destination):"",url:r?.url,finalUrl:r?.finalUrl,httpStatus:r?.httpStatus||0,checkedAt:r?.checkedAt||new Date().toISOString()};
}
function fr24HistoryUrl(f){return `https://www.flightradar24.com/data/flights/${encodeURIComponent(String(f.designator||"").toLowerCase())}`}
function parseFr24HistorySta(text,flight){
  const scope=routeScopedText(text,flight,{before:520,after:1100});
  if(!scope)return "";
  const m=scope.match(/\bSTA\s+(\d{1,2}:\d{2})\b/i);
  return m?localFromUtcClock(flight.date,m[1],flight.destination):"";
}
async function fr24History(flight){
  return withIcaoFallback(flight,fr24HistoryUrl,async f=>{
    const url=fr24HistoryUrl(f),checkedAt=new Date().toISOString(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
    try{
      const r=await fetch(url,{redirect:"follow",signal:controller.signal,headers:{accept:"text/html,application/xhtml+xml","accept-language":"en-US,en;q=0.9","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-FR24-Scheduled/1.2)"}});
      const body=await r.text(),text=htmlText(body),u=upper(text);
      if(/JUST A MOMENT|ATTENTION REQUIRED|VERIFY YOU ARE HUMAN|ACCESS DENIED|UNUSUAL TRAFFIC/.test(u))return {source:"FR24_PUBLIC_SCHEDULED",status:"BLOCKED",url,finalUrl:r.url,httpStatus:r.status,checkedAt};
      if(!r.ok)return {source:"FR24_PUBLIC_SCHEDULED",status:"HTTP_ERROR",url,finalUrl:r.url,httpStatus:r.status,checkedAt};
      const sta=parseFr24HistorySta(text,f);
      return {source:"FR24_PUBLIC_SCHEDULED",status:sta?"OK":"NO_USABLE_DATA",sta,url,finalUrl:r.url,httpStatus:r.status,checkedAt};
    }catch(e){return {source:"FR24_PUBLIC_SCHEDULED",status:e?.name==="AbortError"?"TIMEOUT":"FETCH_ERROR",url,finalUrl:url,httpStatus:0,checkedAt,error:String(e?.message||e).slice(0,220)}}
    finally{clearTimeout(timer)}
  });
}

const READERS=[
  parisAeroport,flightAware,fr24Exact,fr24History,planeFinder,skyscanner,flightView,wego,ixigo,kayak,flightera,flighty,flightradars24fr,simpleFlying
];

export const STA_PUBLIC_SOURCE_ORDER=[
  "FlightStats","Paris Aéroport","FlightAware","Flightradar24 exact","Flightradar24 scheduled","PlaneFinder","Skyscanner","FlightView","Wego","Ixigo","Kayak","Flightera","Flighty","Flightradars24.fr","SimpleFlying"
];

export async function fetchStaFallbacks(flight){
  const attempts=[];
  for(const read of READERS){
    if(read===flightAware)continue;   // FlightAware : ATD uniquement, jamais la STA
    const r=await read(flight),nested=Array.isArray(r.lookupAttempts)?r.lookupAttempts:[];
    if(nested.length)for(const a of nested)attempts.push({source:r.source,status:a.status,lookupDesignator:a.designator,codeType:a.codeType,numberType:a.numberType});
    else attempts.push({source:r.source,status:r.status,lookupDesignator:r.lookupDesignator||flight.designator});
    if(r.status==="OK"&&/^\d{2}:\d{2}$/.test(clean(r.sta)))return {...r,attempts};
  }
  return {source:"PUBLIC_FALLBACKS",status:"NO_USABLE_DATA",sta:"",checkedAt:new Date().toISOString(),attempts};
}
