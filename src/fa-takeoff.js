// Décollage (TO) réel lu sur FlightAware, usage étroit (règle 18) : un vol parti (ATD réel depuis plus de 15 min), sans TO, sans atterrissage ni ATA,
// pour lequel FR24 n'a pas donné de décollage réel (TK1830 : FR24 « Estimated departure », FlightAware et Paris Aéroport « décollé à 11:13 »).
// On ne prend de FlightAware QUE le TO (sa « porte de départ » copie le décollage). Un vol à la fois par passage, mêmes pauses et refus (429) que le reste de FlightAware.
import {AIRPORT_TZ} from "./airport-tz.js";
import {faTakeoffEnabled} from "./fa-policy.js";
import {fetchFlightAwareLive,minutesSinceLocalClock} from "./ops-public-live-flow-optimized.js";
import {timebox,TIMEOUT} from "./cron-budget.js";
const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
const SOURCE="PUBLIC_LIVE:FLIGHTAWARE_TAKEOFF";
export const FA_TO_AFTER_ATD_MIN=15,FA_TO_MAX_SINCE_ATD_MIN=360,FA_TO_MAX_AFTER_GATE_MIN=90,FA_TO_RETRY_MIN=10;
const parisDate=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));
const addDays=(d,n)=>{const t=new Date(d+"T12:00:00Z");t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)};
const mins=v=>{const m=/^(\d{1,2}):(\d{2})/.exec(clean(v));return m?Number(m[1])*60+Number(m[2]):null};
const manual=(x,f)=>upper(x?.[f+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[f]||x?.manualOverrides?.[f]||x?.manual_fields?.[f]);
const zoneOf=x=>AIRPORT_TZ[upper(x?.dep||x?.origin||"CDG")]||"Europe/Paris";

export function wantsFaTakeoff(x,nowMs=Date.now()){
  if(!faTakeoffEnabled()||!x)return false;
  if(clean(x.takeoff)||manual(x,"takeoff")||clean(x.landing)||clean(x.ata))return false;
  if(!clean(x.atd)||/FIDS_ONTIME|FR24MOVE/.test(upper(x.atdSource)))return false;   // ATD réel seulement
  const since=minutesSinceLocalClock(x.atd,zoneOf(x),new Date(nowMs));
  if(since===null||since<FA_TO_AFTER_ATD_MIN||since>FA_TO_MAX_SINCE_ATD_MIN)return false;
  const tried=Date.parse(clean(x.faTakeoffCheckedAt))||0;
  return nowMs-tried>=FA_TO_RETRY_MIN*60000;
}
// Le TO de FlightAware est retenu s'il suit l'heure de porte de 0 à 90 min et n'est pas dans le futur. FR24, dès qu'il donne un TO réel, le remplace (priorité d'origine).
export function decideFaTakeoff(x,value,nowMs=Date.now()){
  const v=clean(value);if(!v)return {ok:false,reason:"AUCUN_TO"};
  const t=mins(v),a=mins(x?.atd);if(t===null||a===null)return {ok:false,reason:"HEURE_ILLISIBLE"};
  let d=t-a;if(d<-720)d+=1440;if(d>720)d-=1440;
  if(d<0||d>FA_TO_MAX_AFTER_GATE_MIN)return {ok:false,reason:"HORS_FENETRE_ATD (écart "+d+" min)"};
  const since=minutesSinceLocalClock(v,zoneOf(x),new Date(nowMs));
  if(since===null||since<0||since>FA_TO_MAX_SINCE_ATD_MIN+FA_TO_MAX_AFTER_GATE_MIN)return {ok:false,reason:"DANS_LE_FUTUR"};
  return {ok:true,value:v};
}
export function applyFaTakeoff(x,value,at){
  const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog.slice():[];
  log.unshift({at,source:SOURCE,field:"takeoff",from:"",to:value});
  return {...x,takeoff:value,takeoffSource:SOURCE,takeoffUpdatedAt:at,flightInfoLog:log.slice(0,240)};
}

export async function runFaTakeoff(env,{limit=1,perFlightMs=9000,nowMs=Date.now()}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  if(!faTakeoffEnabled())return {ok:true,mode:"FA_TAKEOFF",disabled:true};
  const today=parisDate(nowMs),{results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,flight_number,airline,std,data_json FROM flights WHERE flight_date BETWEEN ? AND ? AND airline<>'SYS' ORDER BY flight_date,std,flight_number`).bind(addDays(today,-1),today).all();
  const todo=[];for(const r of results){let x={};try{x=JSON.parse(r.data_json||"{}")}catch{}if(!wantsFaTakeoff(x,nowMs))continue;todo.push({r,x,checked:Date.parse(clean(x.faTakeoffCheckedAt))||0})}
  todo.sort((a,b)=>a.checked-b.checked);
  const out=[];
  for(const z of todo.slice(0,Math.max(1,limit))){
    const {r,x}=z,airline=upper(x.airline||r.airline),designator=upper(x.flight||r.flight_number),number=designator.startsWith(airline)?designator.slice(airline.length):designator;
    const f={date:r.flight_date,airline,number,designator,origin:upper(x.origin||"CDG"),destination:upper(x.destination||x.dest||""),std:clean(x.std||r.std)};
    let fa=null;try{fa=await timebox(()=>fetchFlightAwareLive(f,x.flightAwareHistoryUrl,{narrow:true}),perFlightMs)}catch{fa=null}
    if(fa===TIMEOUT)fa={status:"TIMEOUT"};
    const at=new Date(nowMs).toISOString(),status=fa?.status||"NO_ANSWER";
    if(status==="COOLDOWN"){out.push({flight:designator,status});continue}      // pause FlightAware : rien n'est tenté, rien n'est marqué
    const cur0=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE identity=? LIMIT 1`).bind(r.identity).first();
    let cur={};try{cur=JSON.parse(cur0?.data_json||"{}")}catch{}
    cur.faTakeoffCheckedAt=at;if(fa?.url&&!clean(cur.flightAwareHistoryUrl))cur.flightAwareHistoryUrl=fa.url;
    let res={flight:designator,status};
    if(!clean(cur.takeoff)&&!manual(cur,"takeoff")){
      const d=decideFaTakeoff(cur,fa?.semantic?.takeoff,nowMs);
      if(d.ok){cur=applyFaTakeoff(cur,d.value,at);res={flight:designator,status:"TAKEOFF_WRITTEN",takeoff:d.value}}else res.reason=d.reason;
    }
    await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(cur),r.identity).run();
    out.push(res);
  }
  return {ok:true,mode:"FA_TAKEOFF",pending:todo.length,checked:out.length,results:out};
}
