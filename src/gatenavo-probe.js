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
export async function probeGatenavo(env,{flight=""}={}){
  const out={ok:true,mode:"GATENAVO_PROBE_NO_WRITE",url:URL_DEP};
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),10000);
  let html="";
  try{const r=await fetch(URL_DEP,{signal:c.signal,cf:{cacheTtl:0,cacheEverything:false},headers:{accept:"text/html","accept-language":"fr-FR,fr;q=0.9,en;q=0.7","cache-control":"no-cache",pragma:"no-cache","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-Probe/1.0)"}});
    out.httpStatus=r.status;out.contentType=r.headers.get("content-type")||"";out.cacheHeaders={cacheControl:r.headers.get("cache-control")||"",age:r.headers.get("age")||"",cfCacheStatus:r.headers.get("cf-cache-status")||"",xCache:r.headers.get("x-vercel-cache")||r.headers.get("x-nextjs-cache")||"",date:r.headers.get("date")||""};html=await r.text();out.length=html.length}
  catch(e){out.error=String(e?.name||e?.message||e);return out}finally{clearTimeout(timer)}
  if(/Pardon Our Interruption|Just a moment|cf-chl|Attention Required/i.test(html)){out.error="BOT_PROTECTION";out.head=html.slice(0,200);return out}
  const rows=parseGatenavoFlights(html);out.flights=rows.length;
  if(!rows.length){out.error="NO_ROWS";out.head=html.slice(0,300);return out}
  const byStatus={};for(const r of rows)byStatus[r.status]=(byStatus[r.status]||0)+1;out.byStatus=byStatus;
  const fetched=rows.map(r=>r.fetchedAt).filter(Boolean).sort();out.fetchedFrom=fetched[0]||"";out.fetchedTo=fetched[fetched.length-1]||"";out.fetchedAgeMin=fetched.length?Math.round((Date.now()-Date.parse(fetched[fetched.length-1]))/60000):null;
  const want=gatenavoKey(flight);
  if(want){out.flight=want;out.gatenavoRow=rows.find(r=>gatenavoKey(r.flight)===want)||null;
    if(env?.OPS_DB){const {results=[]}=await env.OPS_DB.prepare(`SELECT flight_number,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(today()).all();
      for(const row of results){let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}if(gatenavoKey(x.flight||row.flight_number)===want){out.ours={status:x.status,statusSource:x.statusSource,parisAeroportPhase:x.parisAeroportPhase,parisAeroportVia:x.parisAeroportVia,parisAeroportPhaseUpdatedAt:x.parisAeroportPhaseUpdatedAt,parisAeroportStatusCheckedAt:x.parisAeroportStatusCheckedAt,std:x.std,etd:x.etd,etdSource:x.etdSource,atd:x.atd,atdSource:x.atdSource,takeoff:x.takeoff,eta:x.eta,etaSource:x.etaSource};break}}}}
  const times=rows.map(r=>r.scheduled).filter(Boolean).sort();out.scheduledFrom=times[0];out.scheduledTo=times[times.length-1];
  out.boarding=rows.filter(r=>r.status==="boarding"||r.status==="gate_closed").map(r=>({flight:r.flight,status:r.status,raw:r.raw,scheduled:r.scheduled})).slice(0,30);
  if(env?.OPS_DB){const date=today(),{results=[]}=await env.OPS_DB.prepare(`SELECT flight_number,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();const set=new Set(rows.map(r=>gatenavoKey(r.flight)));let matched=0;const unmatched=[];
    for(const row of results){let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}const k=gatenavoKey(x.flight||row.flight_number);if(set.has(k))matched++;else unmatched.push({flight:k,std:clean(x.std),dest:upper(x.destination||x.dest),status:clean(x.status)})}
    out.ourFlights=results.length;out.matchedOurs=matched;
    // Nos vols du jour absents de la liste Gatenavo (numéro différent, vol hors de sa fenêtre, affrètement…).
    out.unmatchedOurs=unmatched.sort((a,b)=>String(a.std).localeCompare(String(b.std)))}
  return out;
}

// Lecture des vols pour le flux de statut : null si la page est inaccessible, protégée ou sans vol.
export async function fetchGatenavoRows(){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),10000);
  try{const r=await fetch(URL_DEP,{signal:c.signal,cf:{cacheTtl:0,cacheEverything:false},headers:{accept:"text/html","accept-language":"fr-FR,fr;q=0.9,en;q=0.7","cache-control":"no-cache",pragma:"no-cache","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-Probe/1.0)"}});
    if(!r.ok)return {rows:[],error:"HTTP_"+r.status};const html=await r.text();
    if(/Pardon Our Interruption|Just a moment|cf-chl|Attention Required/i.test(html))return {rows:[],error:"BOT_PROTECTION"};
    const rows=parseGatenavoFlights(html);return {rows,error:rows.length?"":"NO_ROWS"}}
  catch(e){return {rows:[],error:String(e?.name||e?.message||e)}}finally{clearTimeout(timer)}
}
// Statut Paris Aéroport relayé par Gatenavo -> phase. Les autres statuts (programmé, retardé, décollé…) ne produisent aucune phase.
// Clé de correspondance d'un numéro de vol : sans espaces ni zéros de tête (Gatenavo écrit MH021, AF004 ; nous MH21, AF4).
export function gatenavoKey(v){const s=String(v??"").toUpperCase().replace(/\s+/g,"");const m=/^([A-Z0-9]{2})0*(\d+[A-Z]?)$/.exec(s);return m?m[1]+m[2]:s}
export function gatenavoPhase(status){return status==="boarding"?"EMBARQUEMENT":status==="gate_closed"?"EMBARQUEMENT CLOS":status==="cancelled"?"ANNULÉ":""}

// Lecture seule : la page d'un vol (gatenavo.com/en/flights/<vol>) est-elle plus fraîche que la liste des départs ?
// Renvoie le statut et l'heure de mise à jour de chaque côté, plus un extrait brut autour du vol pour repérer les champs de date.
export async function probeGatenavoFlight({flight=""}={}){
  const want=gatenavoKey(flight);if(!want)return {ok:false,error:"flight required"};
  const slug=upper(flight).replace(/\s+/g,"").toLowerCase(),url=`https://gatenavo.com/en/flights/${encodeURIComponent(slug)}`;
  const out={ok:true,mode:"GATENAVO_FLIGHT_PROBE_NO_WRITE",flight:want,url,now:new Date().toISOString()};
  const get=async u=>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),10000);
    try{const r=await fetch(u,{signal:c.signal,cf:{cacheTtl:0,cacheEverything:false},headers:{accept:"text/html","accept-language":"fr-FR,fr;q=0.9,en;q=0.7","cache-control":"no-cache",pragma:"no-cache","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-Probe/1.0)"}});
      const html=await r.text();return {status:r.status,html,age:r.headers.get("age")||"",cache:r.headers.get("x-vercel-cache")||r.headers.get("x-nextjs-cache")||"",date:r.headers.get("date")||""}}
    catch(e){return {status:0,html:"",error:String(e?.name||e?.message||e)}}finally{clearTimeout(timer)}};
  const page=await get(url);out.page={httpStatus:page.status,age:page.age,cache:page.cache,date:page.date,length:page.html.length,error:page.error||""};
  if(page.status===200&&!/Pardon Our Interruption|Just a moment|cf-chl|Attention Required/i.test(page.html)){
    const text=page.html.replace(/\\"/g,'"'),rows=parseGatenavoFlights(page.html).filter(r=>gatenavoKey(r.flight)===want);
    out.page.rows=rows.slice(0,3);
    out.page.updatedText=(text.replace(/<[^>]+>/g," ").match(/Updated[^.]{0,40}(?:ago|now)/i)||[""])[0].trim();
    const i=text.indexOf(`"flightNumber":"${upper(flight).replace(/\s+/g,"")}"`);out.page.excerpt=i>=0?text.slice(Math.max(0,i-300),i+500):"";
  }else if(page.status===200)out.page.error="BOT_PROTECTION";
  const list=await get(URL_DEP);
  if(list.status===200){const r=parseGatenavoFlights(list.html).find(x=>gatenavoKey(x.flight)===want);out.list={status:r?.status||"",raw:r?.raw||"",fetchedAt:r?.fetchedAt||"",ageMin:r?.fetchedAt?Math.round((Date.now()-Date.parse(r.fetchedAt))/60000):null,scheduled:r?.scheduled||""}}
  else out.list={httpStatus:list.status,error:list.error||""};
  return out;
}
