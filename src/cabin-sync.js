// Après un changement d'appareil constaté par une source (tableau FR24, FR24 par vol…), la config cabine choisie automatiquement suit le type réel,
// sans attendre qu'on ouvre la fiche vol. Les configs choisies à la main ne sont jamais touchées (voir applyCabinConfigForActualAircraft).
const parisDate=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));
const addDays=(d,n)=>{const x=new Date(`${d}T12:00:00Z`);x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};

export async function syncCabinAfterAircraftChange(env,{nowMs=Date.now(),apply}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const today=parisDate(nowMs),dates=[addDays(today,-1),today,addDays(today,1)];
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,data_json FROM flights WHERE flight_date IN (?,?,?) AND airline<>'SYS' AND data_json LIKE '%"aircraftChange"%'`).bind(...dates).all();
  if(!results.length)return {ok:true,checked:0,updated:0};
  const fn=apply||(await import("./index.js")).applyCabinConfigForActualAircraft;
  let updated=0;
  for(const r of results){
    let x={};try{x=JSON.parse(r.data_json||"{}")}catch{continue}
    if(!x.aircraftChange)continue;
    if(await fn(env,x))updated++,await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),r.identity).run();
  }
  return {ok:true,checked:results.length,updated};
}
