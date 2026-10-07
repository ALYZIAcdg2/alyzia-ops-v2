// Embarquement saisi à la main depuis la fiche vol (Gatenavo n'est pas assez frais pour suivre l'embarquement en direct).
// La phase est écrite dans parisAeroportPhase avec la source MANUAL : le flux Paris Aéroport / Gatenavo n'y touche plus,
// et le modèle de statut la lit comme n'importe quelle phase d'embarquement (l'ATD, TO, LDG ou ATA prennent ensuite le dessus).
import {derive} from "./status-model-test.js";
const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const parisDate=()=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
export const BOARDING_PHASES=["EMBARQUEMENT","EMBARQUEMENT CLOS","CLEAR"];
export async function setManualBoarding(env,{date="",flight="",phase=""}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const day=clean(date)||parisDate(),wanted=upper(flight).replace(/\s+/g,""),ph=upper(phase);
  if(!wanted)return {ok:false,error:"flight required"};
  if(!BOARDING_PHASES.includes(ph))return {ok:false,error:"BAD_PHASE",allowed:BOARDING_PHASES};
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,flight_number,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(day).all();
  const row=results.find(r=>upper(r.flight_number).replace(/\s+/g,"")===wanted);
  if(!row)return {ok:false,error:"FLIGHT_NOT_FOUND",date:day,flight:wanted};
  let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
  if(ph!=="CLEAR"&&["atd","takeoff","landing","ata"].some(k=>clean(x[k])))return {ok:false,error:"ALREADY_DEPARTED",flight:wanted};
  const at=new Date().toISOString(),before=clean(x.parisAeroportPhase);
  if(ph==="CLEAR"){for(const k of ["parisAeroportPhase","parisAeroportPhaseSource","parisAeroportPhaseUpdatedAt","parisAeroportVia","parisAeroportStatusRaw"])delete x[k]}
  else{x.parisAeroportPhase=ph;x.parisAeroportPhaseSource="MANUAL";x.parisAeroportPhaseUpdatedAt=at;x.parisAeroportVia="MANUAL";x.parisAeroportStatusRaw=ph==="EMBARQUEMENT"?"Embarquement en cours":"Embarquement clos"}
  (x.flightInfoLog??=[]).unshift({at,source:"MANUAL",field:"boarding",from:before,to:ph==="CLEAR"?"":ph});x.flightInfoLog=x.flightInfoLog.slice(0,240);
  // Statut recalculé tout de suite (le cron le ferait au plus tard 2 min plus tard).
  if(!/MANUAL/.test(upper(x.statusSource))){const d=derive(x,row.flight_date||day),arrival=d.arrivalUtc!=null?new Date(d.arrivalUtc).toISOString():"";
    x.status=d.status;x.statusSource=`ALYZIA_STATUS_V1:${d.reason}:${upper(d.evidence?.source||"ALYZIA")}`;x.statusReason=d.reason;x.statusEvidence=d.evidence||{};x.statusArrivalUtc=arrival;x.statusUpdatedAt=at}
  await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();
  return {ok:true,date:day,flight:wanted,phase:ph==="CLEAR"?"":ph,status:x.status};
}
