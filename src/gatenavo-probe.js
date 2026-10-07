// Lecture seule : la page départs CDG de Gatenavo (copie des données Paris Aéroport) est-elle accessible depuis le Worker,
// combien de vols contient-elle, sur quelle plage horaire, et combien de nos vols du jour y retrouve-t-on ?
const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const URL_DEP="https://gatenavo.com/en/airports/paris-cdg/departures";
const today=()=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
export function parseGatenavoFlights(html){
  const t=String(html||"").replace(/\\"/g,'"'),out=[],seen=new Set();
  for(const m of t.matchAll(/\{"id":"(cdg-d-[^"]+)"[^{}]*?"status":"([a-z_]+)"[^{}]*?"rawStatus":"([^"]*)"[^{}]*?"flightNumber":"([A-Z0-9]+)"[^{}]*?"scheduledTime":"([^"]*)"(?:[^{}]*?"sourceFetchedAt":"([^"]*)")?/g)){
    if(seen.has(m[1]))continue;seen.add(m[1]);out.push({id:m[1],status:m[2],raw:m[3],flight:m[4],scheduled:m[5],fetchedAt:m[6]||""})}
  return out;
}
export async function probeGatenavo(env){
  const out={ok:true,mode:"GATENAVO_PROBE_NO_WRITE",url:URL_DEP};
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),10000);
  let html="";
  try{const r=await fetch(URL_DEP,{signal:c.signal,headers:{accept:"text/html","accept-language":"fr-FR,fr;q=0.9,en;q=0.7","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-Probe/1.0)"}});
    out.httpStatus=r.status;out.contentType=r.headers.get("content-type")||"";html=await r.text();out.length=html.length}
  catch(e){out.error=String(e?.name||e?.message||e);return out}finally{clearTimeout(timer)}
  if(/Pardon Our Interruption|Just a moment|cf-chl|Attention Required/i.test(html)){out.error="BOT_PROTECTION";out.head=html.slice(0,200);return out}
  const rows=parseGatenavoFlights(html);out.flights=rows.length;
  if(!rows.length){out.error="NO_ROWS";out.head=html.slice(0,300);return out}
  const byStatus={};for(const r of rows)byStatus[r.status]=(byStatus[r.status]||0)+1;out.byStatus=byStatus;
  const times=rows.map(r=>r.scheduled).filter(Boolean).sort();out.scheduledFrom=times[0];out.scheduledTo=times[times.length-1];
  out.boarding=rows.filter(r=>r.status==="boarding"||r.status==="gate_closed").map(r=>({flight:r.flight,status:r.status,raw:r.raw,scheduled:r.scheduled})).slice(0,30);
  if(env?.OPS_DB){const date=today(),{results=[]}=await env.OPS_DB.prepare(`SELECT flight_number,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();const set=new Set(rows.map(r=>upper(r.flight)));let matched=0;
    for(const row of results){let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}if(set.has(upper(x.flight||row.flight_number).replace(/\s+/g,"")))matched++}
    out.ourFlights=results.length;out.matchedOurs=matched}
  return out;
}

// Lecture des vols pour le flux de statut : null si la page est inaccessible, protégée ou sans vol.
export async function fetchGatenavoRows(){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),10000);
  try{const r=await fetch(URL_DEP,{signal:c.signal,headers:{accept:"text/html","accept-language":"fr-FR,fr;q=0.9,en;q=0.7","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-Probe/1.0)"}});
    if(!r.ok)return {rows:[],error:"HTTP_"+r.status};const html=await r.text();
    if(/Pardon Our Interruption|Just a moment|cf-chl|Attention Required/i.test(html))return {rows:[],error:"BOT_PROTECTION"};
    const rows=parseGatenavoFlights(html);return {rows,error:rows.length?"":"NO_ROWS"}}
  catch(e){return {rows:[],error:String(e?.name||e?.message||e)}}finally{clearTimeout(timer)}
}
// Statut Paris Aéroport relayé par Gatenavo -> phase. Les autres statuts (programmé, retardé, décollé…) ne produisent aucune phase.
export function gatenavoPhase(status){return status==="boarding"?"EMBARQUEMENT":status==="gate_closed"?"EMBARQUEMENT CLOS":status==="cancelled"?"ANNULÉ":""}
