import {AIRPORT_TZ,tzOffsetMinutes} from "./airport-tz.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const today=()=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const manual=x=>upper(x?.statusSource||x?.status_source||"").includes("MANUAL")||Boolean(x?.manual?.status||x?.manualOverrides?.status||x?.manual_fields?.status);
const hhmm=v=>{const m=clean(v).match(/^(\d{1,2}):(\d{2})$/);return m?`${String(Number(m[1])).padStart(2,"0")}:${m[2]}`:""};

const preferred={
  ata:["FLIGHTSTATS","FLIGHTAWARE"],
  landing:["FLIGHTAWARE"],
  takeoff:["FLIGHTAWARE","PARIS_AEROPORT"],
  atd:["FLIGHTSTATS","FLIGHTAWARE"]
};

function sourceOf(x,field){return upper(x?.[field+"Source"]||x?.[field+"_source"]||"")}
function isPreferred(src,list){const s=upper(src);return list.some(v=>s.includes(v))}
function fact(x,field,aliases=[]){for(const k of [field,...aliases]){const v=clean(x?.[k]);if(v)return {value:v,source:sourceOf(x,k)||sourceOf(x,field)||"UNKNOWN"}}return {value:"",source:""}}
function parisPhase(x){return upper(x?.parisAeroportPhase||x?.paris_aeroport_phase||"")}
function flightAwarePhase(x){return upper(x?.statusModelEvidence?.flightAwarePhase||"")}
function localDateTimeUtc(date,time,iata){
  const m=clean(date).match(/^(\d{4})-(\d{2})-(\d{2})$/),t=hhmm(time);if(!m||!t)return null;
  const [h,mi]=t.split(":").map(Number);let guess=Date.UTC(+m[1],+m[2]-1,+m[3],h,mi,0);
  for(let i=0;i<2;i++){const off=tzOffsetMinutes(iata,new Date(guess));guess=Date.UTC(+m[1],+m[2]-1,+m[3],h,mi,0)-off*60000}
  return guess;
}
function arrivalUtc(x,date){
  const arr=hhmm(x.eta||x.estimatedArrival||x.estimated_arrival||x.sta);if(!arr)return null;
  const dest=upper(x.destination||x.dest||"");if(!AIRPORT_TZ[dest])return null;
  const dep=hhmm(x.takeoff||x.takeoffTime||x.takeoff_time||x.atd||x.actualDeparture||x.actual_departure||x.std);if(!dep)return null;
  const origin=upper(x.origin||x.dep||"CDG");let a=localDateTimeUtc(date,dep,origin),b=localDateTimeUtc(date,arr,dest);if(a==null||b==null)return null;while(b<a)b+=86400000;return b;
}
function derive(x,date){
  const faPhase=flightAwarePhase(x),ata=fact(x,"ata",["actualArrival","actual_arrival","gateIn","gate_in"]);
  if(ata.value)return {status:"ARRIVÉ",reason:"ATA",evidence:ata,preferred:isPreferred(ata.source,preferred.ata)};
  if(faPhase==="ARRIVED")return {status:"ARRIVÉ",reason:"FLIGHTAWARE_ARRIVED",evidence:{value:"ARRIVED",source:"FLIGHTAWARE"},preferred:true};

  const landing=fact(x,"landing",["landingTime","landing_time","touchdown"]);
  if(landing.value)return {status:"ATTERRI",reason:"LANDING",evidence:landing,preferred:isPreferred(landing.source,preferred.landing)};
  if(faPhase==="LANDED")return {status:"ATTERRI",reason:"FLIGHTAWARE_LANDED",evidence:{value:"LANDED",source:"FLIGHTAWARE"},preferred:true};

  const takeoff=fact(x,"takeoff",["takeoffTime","takeoff_time"]),phase=parisPhase(x),faAirborne=faPhase==="AIRBORNE"||upper(x?.statusModelEvidence?.airborneSource).includes("FLIGHTAWARE");
  if(takeoff.value||faAirborne||phase==="EN VOL"){
    const source=faAirborne?"FLIGHTAWARE":phase==="EN VOL"?"PARIS_AEROPORT":takeoff.source;
    return {status:"EN VOL",reason:faAirborne?"AIRBORNE":takeoff.value?"TAKEOFF":"PARIS_DECOLLE",evidence:{value:takeoff.value||"AIRBORNE",source},preferred:isPreferred(source,preferred.takeoff),arrivalUtc:arrivalUtc(x,date)};
  }

  const atd=fact(x,"atd",["actualDeparture","actual_departure","gateOut","gate_out"]);
  if(atd.value)return {status:"PARTI",reason:"ATD",evidence:atd,preferred:isPreferred(atd.source,preferred.atd)};

  if(phase==="EMBARQUEMENT CLOS")return {status:"EMBARQUEMENT CLOS",reason:"PARIS_AEROPORT",evidence:{value:phase,source:"PARIS_AEROPORT"},preferred:true};
  if(phase==="EMBARQUEMENT")return {status:"EMBARQUEMENT",reason:"PARIS_AEROPORT",evidence:{value:phase,source:"PARIS_AEROPORT"},preferred:true};
  if(phase==="RETARDÉ")return {status:"RETARDÉ",reason:"PARIS_AEROPORT",evidence:{value:phase,source:"PARIS_AEROPORT"},preferred:true};
  return {status:"À L'HEURE",reason:"DEFAULT",evidence:{value:"",source:"ALYZIA"},preferred:true};
}

export const STATUS_MODEL_TEST_RULES={
  ARRIVE:{trigger:"ATA / FlightAware arrived",sources:["FlightStats","FlightAware"]},
  ATTERRI:{trigger:"LANDING / FlightAware landed",sources:["FlightAware"]},
  EN_VOL:{trigger:"TAKEOFF / AIRBORNE",sources:["FlightAware","Paris Aéroport"],fr24FactsAllowed:true},
  PARTI:{trigger:"ATD",sources:["FlightStats","FlightAware"]},
  EMBARQUEMENT_CLOS:{trigger:"Paris Aéroport",sources:["Paris Aéroport"]},
  EMBARQUEMENT:{trigger:"Paris Aéroport",sources:["Paris Aéroport"]},
  RETARDE:{trigger:"Paris Aéroport",sources:["Paris Aéroport"]},
  A_L_HEURE:{trigger:"default",sources:["ALYZIA"]}
};

export async function runStatusModelTest(env){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const date=today(),{results=[]}=await env.OPS_DB.prepare(`SELECT identity,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();
  let updated=0;const items=[],at=new Date().toISOString();
  for(const row of results){let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}if(manual(x)){items.push({identity:row.identity,status:"MANUAL"});continue}
    const d=derive(x,date),arrivalIso=d.arrivalUtc!=null?new Date(d.arrivalUtc).toISOString():"";
    const before=clean(x.status),beforeArrival=clean(x.statusArrivalUtc),beforeReason=clean(x.statusReason),beforeEvidence=JSON.stringify(x.statusEvidence||{}),beforeSource=clean(x.statusSource);
    const evidenceSource=upper(d.evidence?.source||"ALYZIA");
    x.status=d.status;
    x.statusSource=`ALYZIA_STATUS_MODEL_TEST:${d.reason}:${evidenceSource}`;
    x.statusReason=d.reason;
    x.statusEvidence={...d.evidence,preferred:Boolean(d.preferred)};
    x.statusArrivalUtc=arrivalIso;
    x.statusUpdatedAt=at;
    const changed=before!==x.status||beforeArrival!==arrivalIso||beforeReason!==d.reason||beforeEvidence!==JSON.stringify(x.statusEvidence)||beforeSource!==x.statusSource;
    if(changed){await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();updated++}
    items.push({identity:row.identity,status:d.status,reason:d.reason,source:d.evidence.source||"",statusSource:x.statusSource,preferred:Boolean(d.preferred),arrivalUtc:arrivalIso||null,changed});
  }
  return {ok:true,date,mode:"TEST",updated,checked:results.length,rules:STATUS_MODEL_TEST_RULES,items};
}
