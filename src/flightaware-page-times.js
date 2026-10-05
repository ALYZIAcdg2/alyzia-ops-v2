import {AIRPORT_TZ} from "./airport-tz.js";

// A FlightAware flight page carries its times as JSON in a script (epoch seconds), whatever the language of the page:
//   "gateDepartureTimes":{"scheduled":1759550400,"estimated":null,"actual":1759552620}, "takeoffTimes", "landingTimes", "gateArrivalTimes".
// The label-based reading of the visible text only works for English pages; this one does not depend on the language.
const KEYS={gateDepartureTimes:"atd",takeoffTimes:"takeoff",landingTimes:"landing",gateArrivalTimes:"arrival"};

function normalize(raw){return String(raw||"").replace(/&quot;/g,'"').replace(/\\"/g,'"')}

function localClock(epochSeconds,zone){
  const n=Number(epochSeconds);if(!Number.isFinite(n)||n<=0)return "";
  try{const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:zone||"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(n*1000)).map(x=>[x.type,x.value]));return `${p.hour}:${p.minute}`}catch{return ""}
}

// The occurrence page URL out of whatever text holds it: a page full of share links also contains
// "https://facebook.com/sharer.php?u=https://www.flightaware.com/live/flight/ENT777/history/20261004/0310Z/LFPG/LATI", which must not be taken as a URL.
export function cleanFlightAwareUrl(value){
  const m=String(value??"").replace(/\\\//g,"/").replace(/&amp;/g,"&").match(/https?:\/\/(?:www\.)?flightaware\.com\/live\/flight\/[A-Za-z0-9]+\/history\/\d{8}\/\d{4}Z\/[A-Z]{4}\/[A-Z]{4}/);
  return m?m[0]:"";
}

// The flight page lists several occurrences: "activityLog.flights" holds the other days (the upcoming 6 Oct one comes first), and the occurrence shown by the page
// carries the same keys at the top level of its flight object. Reading the first match gave the times of ANOTHER day (SQ337: ETA 17:40 = the 6 Oct schedule).
function currentFlightObject(src){
  const i=src.indexOf("trackpollBootstrap");if(i<0)return null;
  const start=src.indexOf("{",i);if(start<0)return null;
  let depth=0,inStr=false,esc=false,end=-1;
  for(let k=start;k<src.length;k++){const c=src[k];
    if(inStr){if(esc)esc=false;else if(c==="\\")esc=true;else if(c==='"')inStr=false;continue}
    if(c==='"')inStr=true;else if(c==="{")depth++;else if(c==="}"){depth--;if(depth===0){end=k;break}}}
  if(end<0)return null;
  try{const j=JSON.parse(src.slice(start,end+1)),f=j?.flights;if(!f)return null;const first=Object.values(f)[0];return first&&typeof first==="object"?first:null}catch{return null}
}

// Returns epoch seconds per key, e.g. {atd:{scheduled,estimated,actual},takeoff:{...},landing:{...},arrival:{...}} (missing keys absent).
export function flightAwareJsonTimes(raw){
  const src=normalize(raw),out={},cur=currentFlightObject(src);
  for(const [key,name] of Object.entries(KEYS)){
    if(cur&&cur[key]&&typeof cur[key]==="object"){const o=cur[key],num=v=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;out[name]={scheduled:num(o.scheduled),estimated:num(o.estimated),actual:num(o.actual)};continue}
    // Fallback without a parsable bootstrap: the LAST match is the top-level one (the log of other days comes first).
    const all=[...src.matchAll(new RegExp(`"${key}"\\s*:\\s*\\{([^{}]*)\\}`,"g"))];const m=all[all.length-1];if(!m)continue;
    const read=field=>{const v=m[1].match(new RegExp(`"${field}"\\s*:\\s*(\\d{9,11})`));return v?Number(v[1]):null};
    out[name]={scheduled:read("scheduled"),estimated:read("estimated"),actual:read("actual")};
  }
  return out;
}

// Local clocks: departure facts in the origin zone, arrival facts in the destination zone.
export function flightAwareJsonSemantic(raw,{origin="CDG",destination=""}={}){
  const t=flightAwareJsonTimes(raw),oz=AIRPORT_TZ[String(origin).toUpperCase()]||"Europe/Paris",dz=AIRPORT_TZ[String(destination).toUpperCase()]||oz;
  const out={atd:"",takeoff:"",eta:"",landing:"",ata:""};
  if(t.atd)out.atd=localClock(t.atd.actual,oz);
  if(t.takeoff)out.takeoff=localClock(t.takeoff.actual,oz);
  if(t.landing)out.landing=localClock(t.landing.actual,dz);
  if(t.arrival){out.ata=localClock(t.arrival.actual,dz);if(!t.arrival.actual)out.eta=localClock(t.arrival.estimated,dz)}
  return out;
}

// Short excerpts around the time keys, for the diagnostic when nothing could be read.
export function flightAwareJsonHints(raw){
  const src=normalize(raw),hints=[];
  for(const m of src.matchAll(/"(?:gateDepartureTimes|takeoffTimes|landingTimes|gateArrivalTimes)"/g)){hints.push(src.slice(m.index,m.index+160));if(hints.length>=4)break}
  return hints;
}
