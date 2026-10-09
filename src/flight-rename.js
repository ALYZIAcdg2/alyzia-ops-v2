// Changement du numéro d'un vol depuis la fiche (INFOS VOL). Le numéro fait partie de l'identité du vol (date|compagnie|numéro) : le renommage déplace aussi tout ce qui s'y rattache
// (notes, pièces jointes, dossier Drive, PRÉPA) et note le changement avec son horodatage dans l'historique du vol.
const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
export const identityOf=(date,airline,flight)=>[clean(date),upper(airline),upper(flight)].join("|");
// Numéro valide : désignateur de la même compagnie suivi de 1 à 4 chiffres (suffixe lettre toléré), sans espace.
export function normalizeNewFlight(raw,airline){
  const v=upper(raw).replace(/\s+/g,"");
  const a=upper(airline);
  if(!v||!a||!v.startsWith(a))return "";
  return /^\d{1,4}[A-Z]?$/.test(v.slice(a.length))?v:"";
}
// Identifiants de lecture propres à l'ancien numéro : ils ne valent plus pour le nouveau.
const LOOKUP_KEYS=["fr24OccurrenceId","fr24_occurrence_id","flightStatsId","flightStatsIdDate","flightStatsRefusedAt","flightAwareHistoryUrl","flightawareHistoryUrl","publicLiveBackfill"];
export function renamedFlightData(x,newFlight,at,by="MANUAL"){
  const out={...x},old=clean(x?.flight||x?.designator);
  out.flight=newFlight;if("designator" in out)out.designator=newFlight;
  const log=Array.isArray(out.flightInfoLog)?out.flightInfoLog:[];
  log.unshift({at,source:by,field:"flight",from:old,to:newFlight});
  out.flightInfoLog=log.slice(0,240);
  out.flightRenamedAt=at;out.flightRenamedFrom=old;
  for(const k of LOOKUP_KEYS)delete out[k];
  return out;
}
async function optional(fn){try{return await fn()}catch{return null}}
export async function renameFlight(env,{identity="",newFlight="",by="MANUAL",dryRun=false,nowMs=Date.now()}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const id=clean(identity);if(!id)return {ok:false,error:"IDENTITE_MANQUANTE"};
  const row=await env.OPS_DB.prepare(`SELECT identity,flight_date,airline,flight_number,std,data_json FROM flights WHERE identity=? LIMIT 1`).bind(id).first();
  if(!row)return {ok:false,error:"VOL_INTROUVABLE",identity:id};
  const next=normalizeNewFlight(newFlight,row.airline);
  if(!next)return {ok:false,error:"NUMERO_INVALIDE",detail:`Le numéro doit commencer par ${upper(row.airline)} suivi de 1 à 4 chiffres`};
  const oldFlight=upper(row.flight_number).replace(/\s+/g,"");
  if(next===oldFlight)return {ok:false,error:"NUMERO_IDENTIQUE"};
  const newIdentity=identityOf(row.flight_date,row.airline,next);
  const clash=await env.OPS_DB.prepare(`SELECT identity FROM flights WHERE identity=? LIMIT 1`).bind(newIdentity).first();
  if(clash)return {ok:false,error:"NUMERO_DEJA_UTILISE",identity:newIdentity};
  let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
  const at=new Date(nowMs).toISOString(),data=renamedFlightData(x,next,at,by);
  const plan={identity:id,newIdentity,from:oldFlight,to:next,at};
  if(dryRun)return {ok:true,dryRun:true,...plan};
  await env.OPS_DB.prepare(`UPDATE flights SET identity=?,flight_number=?,data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(newIdentity,next,JSON.stringify(data),id).run();
  const moved={};
  moved.notes=await optional(()=>env.OPS_DB.prepare(`UPDATE flight_notes SET flight_identity=? WHERE flight_identity=?`).bind(newIdentity,id).run());
  moved.attachments=await optional(()=>env.OPS_DB.prepare(`UPDATE flight_attachments SET flight_identity=? WHERE flight_identity=?`).bind(newIdentity,id).run());
  moved.drive=await optional(()=>env.OPS_DB.prepare(`UPDATE lot5_drive_folders SET identity=? WHERE identity=?`).bind(newIdentity,id).run());
  moved.prepa=await optional(()=>env.OPS_DB.prepare(`UPDATE prepa_inbox SET flight_number=? WHERE UPPER(airline)=? AND UPPER(REPLACE(flight_number,' ',''))=? AND flight_date=?`).bind(next,upper(row.airline),oldFlight,row.flight_date).run());
  await optional(()=>env.OPS_DB.prepare(`INSERT INTO ops_meta(k,v) VALUES('flights_epoch',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(String(nowMs)).run());
  const count=r=>Number(r?.meta?.changes||0);
  return {ok:true,...plan,moved:{notes:count(moved.notes),attachments:count(moved.attachments),drive:count(moved.drive),prepa:count(moved.prepa)}};
}
