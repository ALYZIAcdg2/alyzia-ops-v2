// Immatriculation : un même avion ne peut pas partir de CDG deux fois à moins de 2 h d'intervalle ; une immatriculation déjà portée par un autre départ proche est une mauvaise lecture.
export const normRegId=v=>String(v??"").toUpperCase().replace(/[^A-Z0-9]/g,"");
export function sameRegNearby(others,{reg,std,windowMin=120}){
  const r=normRegId(reg),m=v=>{const k=/(\d{1,2}):(\d{2})/.exec(String(v??""));return k?+k[1]*60+ +k[2]:null},s=m(std);if(!r||s===null)return false;
  return others.some(o=>{const x=o.x||{},t=m(x.std||o.std);return t!==null&&normRegId(x.reg||x.registration||x.aircraftRegistration)===r&&String(x.origin||"CDG").toUpperCase()==="CDG"&&Math.abs(t-s)<windowMin});
}
export async function regHeldByNearbyFlight(env,identity,date,reg,std){
  if(!env?.OPS_DB||!normRegId(reg))return false;
  try{const {results=[]}=await env.OPS_DB.prepare(`SELECT std,data_json FROM flights WHERE flight_date=? AND identity<>? AND airline<>'SYS' AND data_json LIKE ?`).bind(date,identity,`%${String(reg).trim()}%`).all();
    return sameRegNearby(results.map(r=>{let x={};try{x=JSON.parse(r.data_json||"{}")}catch{}return {std:r.std,x}}),{reg,std})}
  catch{return false}
}
