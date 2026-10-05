// Lecture du tableau des départs FR24 : extraction du JSON de la page (data-page) et résumé des lignes.
const clean=v=>String(v??"").trim();

export function parseBoard(json,{all=false}={}){
  const props=json?.props||{},flights=Array.isArray(props.flights)?props.flights:[],meta=props.meta||{};
  const rows=flights.map(f=>({
    flight:clean(f.flightNumber),callsign:clean(f.callsign),status:clean(f.status?.name),
    std:Number(f.scheduledTime)||0,time:Number(f.estimatedTime)||0,
    to:clean(f.endpoint?.iata),gate:clean(f.gate),reg:clean(f.aircraft?.registration),type:clean(f.aircraft?.type),
    fr24Id:clean(f.flightId),runwayLocked:!!f.locked?.runway,
  }));
  const count=k=>rows.reduce((m,r)=>(m[r[k]||"-"]=(m[r[k]||"-"]||0)+1,m),{});
  return {total:rows.length,statuses:count("status"),withGate:rows.filter(r=>r.gate).length,withReg:rows.filter(r=>r.reg).length,withFr24Id:rows.filter(r=>r.fr24Id).length,
    departedWithTime:rows.filter(r=>r.status==="departed"&&r.time).length,
    meta:{date:meta.date||0,nextPage:meta.nextPage??null,hasMoreNextData:!!meta.hasMoreNextData,hoursRange:meta.hoursRange||0},sample:rows.slice(0,5),...(all?{rows}:{})};
}

// Page HTML normale : le JSON de la page est dans l'attribut data-page (protocole Inertia). Le mode JSON (x-inertia) exige la version exacte
// des ressources du site et répond 409 sinon ; la page HTML n'a pas cette exigence.
export function extractDataPage(html){
  const m=String(html||"").match(/data-page="([^"]*)"/);if(!m)return null;
  const txt=m[1].replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&");
  try{return JSON.parse(txt)}catch{return null}
}
