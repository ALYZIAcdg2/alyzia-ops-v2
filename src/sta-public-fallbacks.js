import {withIcaoFallback} from "./public-flight-alias.js";
import {fetchFr24Public} from "./fr24-public-html.js";
import {AIRPORT_TZ} from "./airport-tz.js";

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
  const mon=months[Number(m)-1]||"";
  const day=String(Number(d||0));
  return [date,`${d}-${mon}-${y}`,`${day} ${mon} ${y}`,`${mon} ${day} ${y}`,`${d}/${m}/${y}`,`${m}/${d}/${y}`].filter(Boolean).map(upper);
}
function occurrenceMatches(text,flight){
  const u=upper(text);
  const route=flight.origin&&flight.destination&&new RegExp(`\\b${flight.origin}\\b`).test(u)&&new RegExp(`\\b${flight.destination}\\b`).test(u);
  const dated=dateTokens(flight.date).some(t=>u.includes(t));
  const flightMatch=u.includes(upper(flight.designator))||u.includes(`${upper(flight.airline)} ${upper(flight.number)}`);
  return Boolean(route&&dated&&flightMatch);
}
function parseScheduledArrival(text){
  const t=String(text||"");
  const time="(\\d{1,2}:\\d{2}(?:\\s*(?:AM|PM))?)";
  const patterns=[
    new RegExp(`\\bScheduled\\b[\\s\\S]{0,90}?\\bArrival\\b[\\s:,-]{0,20}${time}`,"i"),
    new RegExp(`\\bArrival\\b[\\s\\S]{0,90}?\\bScheduled\\b[\\s:,-]{0,20}${time}`,"i"),
    new RegExp(`\\bScheduled arrival\\b[\\s:,-]{0,20}${time}`,"i"),
    new RegExp(`\\bArrival time\\b[\\s\\S]{0,50}?\\bScheduled\\b[\\s:,-]{0,20}${time}`,"i")
  ];
  for(const p of patterns){const m=t.match(p);if(m){const v=to24(m[1]);if(v)return v}}
  return "";
}
async function fetchPage(name,url,flight){
  const checkedAt=new Date().toISOString();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{
    const r=await fetch(url,{redirect:"follow",signal:controller.signal,headers:{
      accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8",
      "user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-STA-Fallback/1.0; public-web-page)"
    }});
    const body=await r.text(),text=htmlText(body),u=upper(text);
    if(/JUST A MOMENT|ATTENTION REQUIRED|VERIFY YOU ARE HUMAN|ACCESS DENIED|UNUSUAL TRAFFIC/.test(u))return {source:name,status:"BLOCKED",url,finalUrl:r.url,httpStatus:r.status,checkedAt};
    if(!r.ok)return {source:name,status:"HTTP_ERROR",url,finalUrl:r.url,httpStatus:r.status,checkedAt};
    if(/FLIGHT NOT FOUND|UNKNOWN FLIGHT|NO HISTORY DATA|FLIGHT STATUS NOT AVAILABLE/.test(u))return {source:name,status:"NOT_TRACKED",url,finalUrl:r.url,httpStatus:r.status,checkedAt};
    if(!occurrenceMatches(text,flight))return {source:name,status:"OCCURRENCE_MISMATCH",url,finalUrl:r.url,httpStatus:r.status,checkedAt};
    const sta=parseScheduledArrival(text);
    return {source:name,status:sta?"OK":"NO_USABLE_DATA",sta,url,finalUrl:r.url,httpStatus:r.status,checkedAt};
  }catch(e){return {source:name,status:e?.name==="AbortError"?"TIMEOUT":"FETCH_ERROR",url,finalUrl:url,httpStatus:0,error:String(e?.message||e).slice(0,220),checkedAt}}
  finally{clearTimeout(timer)}
}
function flightAwareUrl(f){return `https://www.flightaware.com/live/flight/${encodeURIComponent(f.designator)}`}
async function flightAware(flight){return withIcaoFallback(flight,flightAwareUrl,f=>fetchPage("FLIGHTAWARE_PUBLIC",flightAwareUrl(f),f))}

function localFromIso(iso,iata){
  const d=new Date(iso);if(!Number.isFinite(d.getTime()))return "";
  const zone=AIRPORT_TZ[upper(iata)]||"Europe/Paris";
  try{
    const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d).map(x=>[x.type,x.value]));
    return `${parts.hour}:${parts.minute}`;
  }catch{return ""}
}
async function fr24Exact(flight){
  const r=await fetchFr24Public(flight),c=r?.candidates||{};
  const staIso=c?.semantic?.sta;
  const exact=Boolean(c?.method==="PUBLIC_PLAYBACK"&&c?.occurrenceMatched&&staIso);
  return {source:"FR24_PUBLIC_EXACT",status:exact?"OK":(r?.status||"NO_USABLE_DATA"),sta:exact?localFromIso(staIso,flight.destination):"",url:r?.url,finalUrl:r?.finalUrl,httpStatus:r?.httpStatus||0,checkedAt:r?.checkedAt||new Date().toISOString()};
}
function flighteraUrl(f){return `https://www.flightera.net/en/flight/${encodeURIComponent(f.designator)}`}
async function flightera(flight){return withIcaoFallback(flight,flighteraUrl,f=>fetchPage("FLIGHTERA_PUBLIC",flighteraUrl(f),f))}

export async function fetchStaFallbacks(flight){
  const attempts=[];
  for(const read of [flightAware,fr24Exact,flightera]){
    const r=await read(flight);attempts.push({source:r.source,status:r.status,lookupDesignator:r.lookupDesignator||flight.designator});
    if(r.status==="OK"&&/^\d{2}:\d{2}$/.test(clean(r.sta)))return {...r,attempts};
  }
  return {source:"PUBLIC_FALLBACKS",status:"NO_USABLE_DATA",sta:"",checkedAt:new Date().toISOString(),attempts};
}
