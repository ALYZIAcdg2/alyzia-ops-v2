import {AIRPORT_TZ,tzOffsetMinutes} from "./airport-tz.js";
import {lateBeyondStd15} from "./late-std15.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const today=()=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const manual=x=>upper(x?.statusSource||x?.status_source||"").includes("MANUAL")||Boolean(x?.manual?.status||x?.manualOverrides?.status||x?.manual_fields?.status);
const hhmm=v=>{const m=clean(v).match(/^(\d{1,2}):(\d{2})$/);return m?`${String(Number(m[1])).padStart(2,"0")}:${m[2]}`:""};
const mins=v=>{const t=hhmm(v);if(!t)return null;const [h,m]=t.split(":").map(Number);return h*60+m};

function sourceOf(x,field){return upper(x?.[field+"Source"]||x?.[field+"_source"]||"")}
function fact(x,field,aliases=[]){for(const k of [field,...aliases]){const v=clean(x?.[k]);if(v)return {value:v,source:sourceOf(x,k)||sourceOf(x,field)||"V2_PUBLIC"}}return {value:"",source:""}}
function parisPhase(x){return upper(x?.parisAeroportPhase||x?.paris_aeroport_phase||"")}
function rawSignals(x){return upper([x?.providerStatus,x?.provider_status,x?.publicStatus,x?.public_status,x?.flightStatus,x?.flight_status,x?.statusRaw,x?.status_raw,x?.fr24Status,x?.fr24_status,x?.parisAeroportRaw,x?.paris_aeroport_raw].filter(Boolean).join(" "))}
function localDateTimeUtc(date,time,iata){
  const m=clean(date).match(/^(\d{4})-(\d{2})-(\d{2})$/),t=hhmm(time);if(!m||!t)return null;
  const [h,mi]=t.split(":").map(Number);let guess=Date.UTC(+m[1],+m[2]-1,+m[3],h,mi,0);
  for(let i=0;i<2;i++){const off=tzOffsetMinutes(iata,new Date(guess));guess=Date.UTC(+m[1],+m[2]-1,+m[3],h,mi,0)-off*60000}
  return guess;
}
function arrivalUtc(x,date){
  const arr=hhmm(x.eta||x.estimatedArrival||x.estimated_arrival||x.sta);if(!arr)return null;
  const dest=upper(x.destination||x.dest||"");if(!AIRPORT_TZ[dest])return null;
  const dep=hhmm(x.atd||x.actualDeparture||x.actual_departure||x.takeoff||x.takeoffTime||x.takeoff_time||x.std);if(!dep)return null;
  const origin=upper(x.origin||x.dep||"CDG");let a=localDateTimeUtc(date,dep,origin),b=localDateTimeUtc(date,arr,dest);if(a==null||b==null)return null;while(b<a)b+=86400000;return b;
}
function etaPassedBy15(x,date,nowMs){const a=arrivalUtc(x,date);return a!=null&&nowMs>=a+15*60000}
function etdDelayed(x){const s=mins(x.std),e=mins(x.etd);if(s==null||e==null)return false;let d=e-s;if(d<-720)d+=1440;if(d>720)d-=1440;return d>=5}
// cancelledSource: written by the live flow when a cancellation is confirmed (FlightStats banner / two sources); without it this model overwrote ANNULÉ with À L'HEURE (AI142).
function cancelled(x){return Boolean(clean(x?.cancelledSource))||(/^ANNUL/.test(upper(x?.status))&&/PUBLIC_LIVE|:CANCELLED:/.test(upper(x?.statusSource)))||/CANCEL|ANNUL/.test(rawSignals(x))||parisPhase(x)==="ANNULÉ"}
function boarding(x){const p=parisPhase(x);return p==="EMBARQUEMENT"||p==="EMBARQUEMENT CLOS"||/BOARDING|EMBARQUEMENT/.test(rawSignals(x))}
function delayed(x){return parisPhase(x)==="RETARDÉ"||/DELAY|RETARD/.test(rawSignals(x))||etdDelayed(x)}

export function derive(x,date,nowMs=Date.now()){
  if(cancelled(x))return {status:"ANNULÉ",reason:"CANCELLED",evidence:{value:"CANCELLED",source:"V2_PUBLIC"}};

  const ata=fact(x,"ata",["actualArrival","actual_arrival","gateIn","gate_in"]);
  if(ata.value)return {status:"ARRIVÉ",reason:"ATA",evidence:ata};

  const atd=fact(x,"atd",["actualDeparture","actual_departure","gateOut","gate_out"]);
  const landing=fact(x,"landing",["landingTime","landing_time"]),takeoff=fact(x,"takeoff",["takeoffTime","takeoff_time"]);
  if((atd.value||takeoff.value||landing.value)&&etaPassedBy15(x,date,nowMs))return {status:"ARRIVÉ",reason:"ETA_PASSED_15",evidence:{value:x.eta||x.sta||"",source:sourceOf(x,x.eta?"eta":"sta")||"V2_PUBLIC"}};

  // Étapes : ATD = PARTI (sorti du poste), TO = EN VOL, LDG = ATTERRI, ATA = ARRIVÉ.
  if(landing.value)return {status:"ATTERRI",reason:"LANDING",evidence:landing,arrivalUtc:arrivalUtc(x,date)};
  if(takeoff.value)return {status:"EN VOL",reason:"TAKEOFF",evidence:takeoff,arrivalUtc:arrivalUtc(x,date)};
  if(atd.value)return {status:"PARTI",reason:"ATD",evidence:atd,arrivalUtc:arrivalUtc(x,date)};

  if(boarding(x)){
    const p=parisPhase(x);
    return {status:p==="EMBARQUEMENT CLOS"?"EMBARQUEMENT CLOS":"EMBARQUEMENT",reason:"BOARDING",evidence:{value:p||"BOARDING",source:p?"PARIS_AEROPORT":"V2_PUBLIC"}};
  }

  // RETARDÉ seulement une fois la STD dépassée de 15 min sans départ ; avant, un ETD ou un signal de retard ne change pas l'affichage « à l'heure ».
  if(lateBeyondStd15(x,date,nowMs))return {status:"RETARDÉ",reason:"STD_PLUS_15",evidence:{value:x.std||"",source:"ALYZIA"}};

  return {status:"PROGRAMMÉ",reason:"DEFAULT",evidence:{value:"",source:"ALYZIA"}};
}

export const STATUS_MODEL_TEST_RULES={
  mode:"V1_LOGIC_V2_PUBLIC_SOURCES",
  ARRIVE:{trigger:"ATA, ou ETA/STA dépassée de 15 min après ATD",sources:["V2 public sources"]},
  PARTI:{trigger:"ATD (sorti du poste, pas encore décollé)",sources:["FIDS","FlightStats","FlightAware","FR24"]},
  ATTERRI:{trigger:"LDG renseigné, ATA absent",sources:["FIDS","FR24","fallbacks publics"]},
  EN_VOL:{trigger:"TO (décollage) renseigné",sources:["FlightStats","FlightAware","FR24","Paris Aéroport","autres fallbacks publics"]},
  EMBARQUEMENT:{trigger:"signal boarding public",sources:["Paris Aéroport","V2 public sources"]},
  RETARDE:{trigger:"vol non parti et heure actuelle >= STD + 15 min",sources:["ALYZIA"]},
  PROGRAMME:{trigger:"aucun événement opérationnel",sources:["ALYZIA"]},
  APIs:false
};

export async function runStatusModelTest(env){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  // Flights of yesterday are recomputed too: after midnight an evening departure is still airborne / just landed.
  const date=today(),from=(()=>{const t=new Date(`${date}T12:00:00Z`);t.setUTCDate(t.getUTCDate()-1);return t.toISOString().slice(0,10)})(),{results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,data_json FROM flights WHERE flight_date BETWEEN ? AND ? AND airline<>'SYS'`).bind(from,date).all();
  let updated=0;const items=[],at=new Date().toISOString();
  for(const row of results){
    let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
    if(manual(x)){items.push({identity:row.identity,status:"MANUAL"});continue}
    const d=derive(x,row.flight_date||date),arrivalIso=d.arrivalUtc!=null?new Date(d.arrivalUtc).toISOString():"";
    const before={status:clean(x.status),arrival:clean(x.statusArrivalUtc),reason:clean(x.statusReason),evidence:JSON.stringify(x.statusEvidence||{}),source:clean(x.statusSource)};
    x.status=d.status;
    x.statusSource=`ALYZIA_STATUS_V1:${d.reason}:${upper(d.evidence?.source||"ALYZIA")}`;
    x.statusReason=d.reason;
    x.statusEvidence=d.evidence||{};
    x.statusArrivalUtc=arrivalIso;
    x.statusUpdatedAt=at;
    delete x.statusModelEvidence;
    const changed=before.status!==x.status||before.arrival!==arrivalIso||before.reason!==d.reason||before.evidence!==JSON.stringify(x.statusEvidence)||before.source!==x.statusSource;
    if(changed){await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();updated++}
    items.push({identity:row.identity,status:d.status,reason:d.reason,source:d.evidence?.source||"",statusSource:x.statusSource,arrivalUtc:arrivalIso||null,changed});
  }
  return {ok:true,date,mode:"V1_LOGIC_V2_PUBLIC_SOURCES",updated,checked:results.length,rules:STATUS_MODEL_TEST_RULES,items};
}
