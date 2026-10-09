import {flightAwareEnabled} from "./fa-policy.js";
import {fetchFr24Public} from "./fr24-public-html.js";
import {AIRPORT_TZ} from "./airport-tz.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})/);return m?`${String(Number(m[1])).padStart(2,"0")}:${m[2]}`:""};
const today=()=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const manual=(x,field)=>upper(x?.[field+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[field]||x?.manualOverrides?.[field]||x?.manual_fields?.[field]);

const EXACT_FR24={
  "LO334|2026-10-03":"41f2d8d9","RJ120|2026-10-03":"41f2da8b","TK1830|2026-10-03":"41f2d733",
  "AV55|2026-10-03":"41f30e95","HF177|2026-10-03":"41f31243","SQ335|2026-10-03":"41f35170",
  "VF12|2026-10-03":"41f3a1d1","SM3778|2026-10-03":"41f44e42","VF10|2026-10-03":"41f48b45",
  "VF516|2026-10-03":"41f490f9","TK1834|2026-10-03":"41f49d19","AH1215|2026-10-03":"41f4d035",
  "NH216|2026-10-03":"41f4e62f","OZ502|2026-10-03":"41f4ec4d","TK1828|2026-10-03":"41f4f61e",
  "LO336|2026-10-03":"41f4f8fe","SK560|2026-10-03":"41f51360","AH1085|2026-10-03":"41f51d65",
  "BM591|2026-10-03":"41f4f154"
};

const EXACT_FA={
  "VF10|2026-10-03":"https://flightaware.com/live/flight/TKJ10/history/20261003/1535Z/LFPG/LTFJ",
  "VF516|2026-10-03":"https://flightaware.com/live/flight/TKJ516/history/20261003/1550Z/LFPG/LTAC",
  "AH1215|2026-10-03":"https://flightaware.com/live/flight/DAH1215/history/20261003/1610Z/LFPG/DAAG",
  "TK1834|2026-10-03":"https://flightaware.com/live/flight/THY1834/history/20261003/1615Z/LFPG/LTFM",
  "AT789|2026-10-03":"https://flightaware.com/live/flight/RAM789/history/20261003/1640Z/LFPG/GMMN",
  "OZ502|2026-10-03":"https://flightaware.com/live/flight/AAR502/history/20261003/1720Z/LFPG/RKSI",
  "NH216|2026-10-03":"https://flightaware.com/live/flight/ANA216/history/20261003/1730Z/LFPG/RJTT",
  "AH1085|2026-10-03":"https://flightaware.com/live/flight/DAH1085/history/20261003/1745Z/LFPG/DAOO",
  "BM591|2026-10-03":"https://flightaware.com/live/flight/MNS591/history/20261003/1755Z/LFPG/HLLM",
  "LO336|2026-10-03":"https://flightaware.com/live/flight/LOT336/history/20261003/1755Z/LFPG/EPWA",
  "TK1828|2026-10-03":"https://flightaware.com/live/flight/THY1828/history/20261003/1800Z/LFPG/LTFM",
  "SK560|2026-10-03":"https://flightaware.com/live/flight/SAS560/history/20261003/1825Z/LFPG/EKCH"
};

const EXACT_PARIS={
  "SK568|2026-10-03":"https://wsmobile.aeroportsdeparis.fr/myairport/flight/detail?compositeKey=20261003SK%20%20%20568CDG%20CPH"
};

function clockFromIso(iso,zone){if(!iso)return"";const d=new Date(iso);if(Number.isNaN(d.getTime()))return"";try{const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:zone||"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d).map(x=>[x.type,x.value]));return `${p.hour}:${p.minute}`}catch{return""}}
function textOnly(html){return String(html||"").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/\s+/g," ").trim()}
function normalizeTime(raw){const m=upper(raw).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/);if(!m)return"";let h=Number(m[1]);if(m[3]==="AM"&&h===12)h=0;if(m[3]==="PM"&&h!==12)h+=12;return h<24?`${String(h).padStart(2,"0")}:${m[2]}`:""}
function firstTime(text,patterns){for(const re of patterns){const m=String(text||"").match(re);if(m){const t=normalizeTime(m[1]);if(t)return t}}return""}
function faFacts(text){return {
  atd:firstTime(text,[/(?:gate departure|actual departure|gate out|left gate)[^0-9]{0,80}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i]),
  takeoff:firstTime(text,[/(?:takeoff|take-off|took off|wheels up|airborne)[^0-9]{0,80}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i]),
  eta:firstTime(text,[/(?:estimated gate arrival|estimated arrival|ETA)[^0-9]{0,80}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i]),
  ata:firstTime(text,[/(?:gate arrival|actual arrival|arrived at gate|gate in)[^0-9]{0,80}(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i])
}}
async function fetchText(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),7000);try{const r=await fetch(url,{redirect:"follow",signal:c.signal,headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-ExactRecovery/1.0)"}});if(!r.ok)return"";return textOnly(await r.text())}catch{return""}finally{clearTimeout(t)}}
function setField(x,field,value,source,at){if(!value||manual(x,field))return false;const before=clean(x[field]);if(before===value&&upper(x[field+"Source"])===upper(source))return false;const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source,field,from:before,to:value});x.flightInfoLog=log.slice(0,240);x[field]=value;x[field+"Source"]=source;x[field+"UpdatedAt"]=at;return true}

export async function runExactOccurrenceRecovery(env){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const date=today(),{results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_number,airline,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS' ORDER BY std,flight_number`).bind(date).all();
  let checked=0,updated=0;const items=[];
  for(const row of results){let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}const flight=upper(x.flight||row.flight_number),key=`${flight}|${date}`;if(!EXACT_FR24[key]&&!EXACT_FA[key]&&!EXACT_PARIS[key])continue;checked++;const at=new Date().toISOString();let changed=false,notes=[];
    if(EXACT_FR24[key]){try{const f={date,airline:upper(x.airline||row.airline),number:flight.replace(/^[A-Z0-9]{2,3}(?=\d)/,""),designator:flight,origin:upper(x.origin||"CDG"),destination:upper(x.destination||x.dest||""),std:hhmm(x.std||row.std),raw:{...x,fr24OccurrenceId:EXACT_FR24[key]}};const r=await fetchFr24Public(f),s=r?.candidates?.semantic||{};const takeoff=clockFromIso(s.takeoff,"Europe/Paris"),eta=clockFromIso(s.eta,AIRPORT_TZ[f.destination]||"Europe/Paris"),landing=clockFromIso(s.landing,AIRPORT_TZ[f.destination]||"Europe/Paris");if(setField(x,"takeoff",takeoff,"PUBLIC_EXACT:FR24",at))changed=true;if(setField(x,"eta",eta,"PUBLIC_EXACT:FR24",at))changed=true;if(setField(x,"landing",landing,"PUBLIC_EXACT:FR24",at))changed=true;if(takeoff)notes.push(`FR24 TAKEOFF ${takeoff}`);x.fr24OccurrenceId=EXACT_FR24[key]}catch{}}
    if(EXACT_FA[key]&&flightAwareEnabled()){const text=await fetchText(EXACT_FA[key]);if(text){const f=faFacts(text);if(setField(x,"atd",f.atd,"PUBLIC_EXACT:FLIGHTAWARE",at))changed=true;if(setField(x,"takeoff",f.takeoff,"PUBLIC_EXACT:FLIGHTAWARE",at))changed=true;if(setField(x,"eta",f.eta,"PUBLIC_EXACT:FLIGHTAWARE",at))changed=true;if(setField(x,"ata",f.ata,"PUBLIC_EXACT:FLIGHTAWARE",at))changed=true;if(f.atd)notes.push(`FA ATD ${f.atd}`)}}
    if(EXACT_PARIS[key]){const text=await fetchText(EXACT_PARIS[key]);if(/ANNUL|CANCEL/i.test(text)){if(clean(x.parisAeroportPhase)!=="ANNULÉ"){x.parisAeroportPhase="ANNULÉ";x.parisAeroportPhaseSource="PARIS_AEROPORT_EXACT";x.parisAeroportPhaseUpdatedAt=at;changed=true}notes.push("PARIS ANNULÉ")}}
    x.exactOccurrenceRecovery={checkedAt:at,fr24:EXACT_FR24[key]||null,flightAware:EXACT_FA[key]||null,paris:EXACT_PARIS[key]||null};
    if(changed){await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();updated++}
    items.push({flight,changed,notes});
  }
  return {ok:true,date,checked,updated,items};
}
