import {guardDepartureClock} from "./local-time-guard.js";
import {AIRPORT_TZ} from "./airport-tz.js";
import {flightAwareJsonSemantic,cleanFlightAwareUrl} from "./flightaware-page-times.js";
const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})/);return m?`${String(Number(m[1])).padStart(2,"0")}:${m[2]}`:""};
const manual=(x,field)=>upper(x?.[field+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[field]||x?.manualOverrides?.[field]||x?.manual_fields?.[field]);
const COOLDOWN_429_MS=45*60*1000;

const EXACT={
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
  "SK560|2026-10-03":"https://flightaware.com/live/flight/SAS560/history/20261003/1825Z/LFPG/EKCH",
  "SQ337|2026-10-03":"https://www.flightaware.com/live/flight/SIA337/history/20261003/2045Z/LFPG/WSSS",
  "LO334|2026-10-03":"https://flightaware.com/live/flight/LOT334/history/20261003/0515Z/LFPG/EPWA",
  "RJ120|2026-10-03":"https://flightaware.com/live/flight/RJA120/history/20261003/0530Z/LFPG/OJAI",
  "TK1830|2026-10-03":"https://flightaware.com/live/flight/THY1830/history/20261003/0530Z/LFPG/LTFM"
};
function textOnly(html){return String(html||"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/\s+/g," ").trim()}
function blocked(text){return /just a moment|attention required|verify you are human|incapsula|access denied|unusual traffic|cf-chl/i.test(text)}
function firstTime(text,patterns){for(const p of patterns){const m=String(text||"").match(p);if(m){const v=hhmm(m[1]);if(v)return v}}return ""}
function registration(text){return upper((String(text||"").match(/\b(F-[A-Z]{4}|TC-[A-Z]{3}|TS-[A-Z]{3}|SU-[A-Z]{3}|CC-[A-Z]{3}|9V-[A-Z]{3}|9M-[A-Z]{3}|EI-[A-Z]{3}|SP-[A-Z]{3}|YU-[A-Z]{3}|LZ-[A-Z]{3}|9XR-[A-Z]{2,3}|7T-[A-Z]{3}|HL\d{4}|JA\d{3,4}[A-Z]?|VT-[A-Z]{3}|CN-[A-Z]{3}|N\d{1,5}[A-Z]{0,2}|[A-Z]{1,2}-[A-Z]{3,5})\b/i)||[])[1]||"")}
function aircraft(text){return upper((String(text||"").match(/\b(A20N|A21N|A319|A320|A321|A332|A333|A339|A343|A350|A359|A380|B38M|B39M|B737|B738|B739|B748|B752|B753|B763|B764|B772|B773|B77W|B788|B789|BCS1|BCS3|32B|32Q|77W|788|789|359|333|332|320|321)\b/i)||[])[1]||"")}
function semantic(text){return {atd:firstTime(text,[/(?:gate departure|left gate|actual departure|departed gate|départ porte|départ réel)[^0-9]{0,80}(\d{1,2}:\d{2})/i]),takeoff:firstTime(text,[/(?:takeoff|took off|wheels up|airborne|décollage)[^0-9]{0,80}(\d{1,2}:\d{2})/i]),eta:firstTime(text,[/(?:estimated arrival|arrival estimate|ETA|arrivée estimée)[^0-9]{0,80}(\d{1,2}:\d{2})/i]),landing:firstTime(text,[/(?:landed|landing|touchdown|wheels down|atterrissage)[^0-9]{0,80}(\d{1,2}:\d{2})/i]),ata:firstTime(text,[/(?:gate arrival|arrived at gate|actual arrival|ATA|arrivée réelle)[^0-9]{0,80}(\d{1,2}:\d{2})/i]),reg:registration(text),aircraft:aircraft(text)}}
function setField(x,field,value,at){if(!value||manual(x,field))return false;
  if(field==="atd"||field==="takeoff"){const g=guardDepartureClock(value,x.std,x.activeDate||x.date,AIRPORT_TZ[upper(x.dep||x.origin||"CDG")]||"Europe/Paris");if(g.status==="REJECTED")return false;value=g.value}
  const before=clean(x[field]);if(before===value&&upper(x[field+"Source"]).includes("FLIGHTAWARE"))return false;const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:"PUBLIC_LIVE:FLIGHTAWARE_EXACT",field,from:before,to:value});x.flightInfoLog=log.slice(0,240);x[field]=value;x[field+"Source"]="PUBLIC_LIVE:FLIGHTAWARE_EXACT";x[field+"UpdatedAt"]=at;if(field==="reg"){x.registration=value;x.aircraftRegistration=value}return true}
function designator(row,x){const a=upper(x.airline||row.airline),f=upper(x.flight||row.flight_number);return f.startsWith(a)?f:`${a}${String(row.flight_number||"").replace(/^[A-Z0-9]{2,3}(?=\d)/,"")}`}
function mergeTelemetry(x,attempt,at){const live=x.publicLiveBackfill&&typeof x.publicLiveBackfill==="object"?x.publicLiveBackfill:{},old=Array.isArray(live.attempts)?live.attempts:[],kept=old.filter(a=>!(upper(a?.source)==="FLIGHTAWARE"&&clean(a?.url)===clean(attempt.url)));x.publicLiveBackfill={...live,checkedAt:at,attempts:[attempt,...kept].slice(0,40)};x.flightAwareExactHistory={checkedAt:at,url:attempt.url,cooldown429Minutes:45,attempts:[attempt]}}
function on429Cooldown(x,now=Date.now()){const h=x?.flightAwareExactHistory||{},a=Array.isArray(h.attempts)?h.attempts[0]:null;if(!a||Number(a.httpStatus)!==429)return false;const t=Date.parse(a.checkedAt||h.checkedAt||0);return Number.isFinite(t)&&now-t<COOLDOWN_429_MS}

export async function recoverFlightAwareExactHistory(env){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const date=new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,airline,flight_number,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();
  let checked=0,success=0,updated=0,cooldownSkipped=0;const flights=[];
  for(const row of results){let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}const key=`${designator(row,x)}|${row.flight_date}`,url=cleanFlightAwareUrl(x.flightAwareHistoryUrl||x.flightawareHistoryUrl)||clean(EXACT[key]);if(!url)continue;if(on429Cooldown(x)){cooldownSkipped++;continue}checked++;const at=new Date().toISOString();let attempt={source:"FLIGHTAWARE",status:"FETCH_ERROR",checkedAt:at,url};
    try{
      const c=new AbortController(),timer=setTimeout(()=>c.abort(),8000);let r,raw="";try{r=await fetch(url,{redirect:"follow",signal:c.signal,headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-FlightAwareExact/1.1)"}});raw=await r.text()}finally{clearTimeout(timer)}
      const text=textOnly(raw);attempt={source:"FLIGHTAWARE",status:blocked(text)?"BLOCKED":r.ok?"OK":"HTTP_ERROR",httpStatus:r.status,checkedAt:at,url:r.url||url,lookupCodeType:"ICAO",lookupDesignator:(url.match(/\/flight\/([^/]+)/i)||[])[1]||""};
      if(attempt.status==="OK"){success++;const s=semantic(text),js=flightAwareJsonSemantic(raw,{origin:x.origin||"CDG",destination:x.destination||x.dest||""});for(const k of ["atd","takeoff","eta","landing","ata"])if(!s[k]&&js[k])s[k]=js[k];let changed=false;for(const field of ["atd","takeoff","eta","landing","ata","reg"]){if(setField(x,field,s[field],at))changed=true}if(s.aircraft&&!manual(x,"aircraft")&&upper(x.aircraftActual||x.aircraft)!==s.aircraft){x.aircraftActual=s.aircraft;x.aircraftActualSource="PUBLIC_LIVE:FLIGHTAWARE_EXACT";x.aircraftActualUpdatedAt=at;changed=true}if(changed){updated++;flights.push(designator(row,x))}}
    }catch(e){attempt={source:"FLIGHTAWARE",status:e?.name==="AbortError"?"TIMEOUT":"FETCH_ERROR",checkedAt:at,url,error:String(e?.message||e).slice(0,140)}}
    mergeTelemetry(x,attempt,at);try{await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run()}catch{}
  }
  return {ok:true,date,checked,success,failed:checked-success,updated,cooldownSkipped,cooldown429Minutes:45,flights};
}
