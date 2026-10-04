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

// Returns epoch seconds per key, e.g. {atd:{scheduled,estimated,actual},takeoff:{...},landing:{...},arrival:{...}} (missing keys absent).
export function flightAwareJsonTimes(raw){
  const src=normalize(raw),out={};
  for(const [key,name] of Object.entries(KEYS)){
    const m=src.match(new RegExp(`"${key}"\\s*:\\s*\\{([^{}]*)\\}`));if(!m)continue;
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
