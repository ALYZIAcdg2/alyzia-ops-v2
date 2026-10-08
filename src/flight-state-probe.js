// Lecture seule : toutes les heures d'un vol avec leur source, et les dernières écritures du journal pour ces champs.
const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const parisDate=()=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const FIELDS=["std","etd","atd","takeoff","landing","ata","sta","eta"];
export async function readFlightState(env,{date="",flight=""}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const day=clean(date)||parisDate(),wanted=upper(flight).replace(/\s+/g,"");if(!wanted)return {ok:false,error:"flight required"};
  const {results=[]}=await env.OPS_DB.prepare(`SELECT flight_date,flight_number,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(day).all();
  const row=results.find(r=>upper(r.flight_number).replace(/\s+/g,"")===wanted);if(!row)return {ok:false,error:"FLIGHT_NOT_FOUND",date:day,flight:wanted};
  let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
  const times={};for(const f of FIELDS)times[f]={value:clean(x[f]),source:clean(x[f+"Source"]),updatedAt:clean(x[f+"UpdatedAt"]),day:x[f+"Day"]??null};
  const log=(Array.isArray(x.flightInfoLog)?x.flightInfoLog:[]).filter(l=>["takeoff","landing","ata","atd","etd","edt","reg","registration","aircraftChange","boarding"].includes(l?.field)).slice(0,40);
  const reg={value:clean(x.reg||x.registration),source:clean(x.regSource||x.registrationSource),updatedAt:clean(x.regUpdatedAt||x.registrationUpdatedAt)};
  return {ok:true,date:day,flight:wanted,reg,origin:x.origin||x.dep||"",destination:x.destination||x.dest||"",status:x.status,statusSource:x.statusSource,statusReason:x.statusReason,statusArrivalUtc:x.statusArrivalUtc,times,parisAeroportPhase:x.parisAeroportPhase,aircraftActual:x.aircraftActual,log};
}
