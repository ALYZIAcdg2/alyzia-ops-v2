// Lecture seule : pour une date, qui a écrit chaque ATA (source), avec LDG, ATD et résumé par source.
const clean=v=>String(v??"").trim();
const parisDate=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));

export function ataSources(rows){
  const bySource={},flights=[];let withoutAta=0;
  for(const x of rows){
    const ata=clean(x.ata);
    if(!ata){if(clean(x.takeoff)||clean(x.landing)||clean(x.atd))withoutAta++;continue}
    const src=clean(x.ataSource)||"(source non enregistrée)";
    bySource[src]=(bySource[src]||0)+1;
    flights.push({flight:clean(x.flight),std:clean(x.std).slice(0,5),ata:ata.slice(0,5),ataSource:src,landing:clean(x.landing).slice(0,5),landingSource:clean(x.landingSource),atd:clean(x.atd).slice(0,5),atdSource:clean(x.atdSource)});
  }
  flights.sort((a,b)=>a.ata.localeCompare(b.ata));
  return {total:flights.length,withoutAta,bySource,flights};
}

export async function ataSourcesReport(env,{date="",nowMs=Date.now()}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const day=date||parisDate(nowMs);
  const {results=[]}=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(day).all();
  const rows=results.map(r=>{try{return JSON.parse(r.data_json||"{}")}catch{return {}}});
  return {ok:true,mode:"ATA_SOURCES_NO_WRITE",date:day,...ataSources(rows)};
}
