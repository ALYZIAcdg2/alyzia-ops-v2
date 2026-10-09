// Lien FR24 d'un vol saisi dans la fiche (INFOS VOL) : l'identifiant de l'occurrence (8 caractères hexadécimaux, par ex. flightradar24.com/ENT9ZW/420b0f1c) permet à la lecture FR24 du vol
// de retrouver ce vol exact, même quand le tableau de CDG et la recherche par numéro ne le trouvent pas (vol charter, numéro renommé, STD différente).
const clean=v=>String(v??"").trim();
const HEX=/^[0-9a-f]{8}$/;
// Identifiant : à la fin d'une adresse flightradar24.com (…/ENT9ZW/420b0f1c ou …#420b0f1c) ou saisi seul. Une date (20261009…) n'en est jamais un.
export function fr24IdFromLink(raw){
  const v=clean(raw).toLowerCase();if(!v)return "";
  if(HEX.test(v)&&!/^20\d{6}$/.test(v))return v;
  const m=/flightradar24\.com\/[^\s?#]*[\/#]([0-9a-f]{8})(?=[\/?#\s]|$)/.exec(v)||/flightradar24\.com\/[^\s]*#([0-9a-f]{8})(?=[\/?\s]|$)/.exec(v);
  return m&&!/^20\d{6}$/.test(m[1])?m[1]:"";
}
export async function setFr24Link(env,{identity="",link="",dryRun=false,nowMs=Date.now()}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const id=clean(identity);if(!id)return {ok:false,error:"IDENTITE_MANQUANTE"};
  const fr24=fr24IdFromLink(link);
  if(!fr24)return {ok:false,error:"LIEN_INVALIDE",detail:"Colle l'adresse de la page du vol sur flightradar24.com (elle se termine par 8 caractères, par exemple /ENT9ZW/420b0f1c)."};
  const row=await env.OPS_DB.prepare(`SELECT identity,data_json FROM flights WHERE identity=? LIMIT 1`).bind(id).first();
  if(!row)return {ok:false,error:"VOL_INTROUVABLE",identity:id};
  let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
  const at=new Date(nowMs).toISOString(),before=clean(x.fr24OccurrenceId);
  if(dryRun)return {ok:true,dryRun:true,identity:id,fr24OccurrenceId:fr24,before,at};
  x.fr24OccurrenceId=fr24;x.fr24OccurrenceIdSource="MANUAL";x.fr24OccurrenceIdAt=at;
  const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:"MANUAL",field:"fr24",from:before,to:fr24});x.flightInfoLog=log.slice(0,240);
  delete x.publicLiveBackfill;   // le vol repasse en tête de la prochaine lecture
  await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),id).run();
  try{await env.OPS_DB.prepare(`INSERT INTO ops_meta(k,v) VALUES('flights_epoch',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(String(nowMs)).run()}catch{}
  return {ok:true,identity:id,fr24OccurrenceId:fr24,before,at};
}
