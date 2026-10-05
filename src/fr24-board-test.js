// Diagnostic LECTURE SEULE du tableau des départs FR24 (une page = 100 vols). N'écrit rien, ne touche pas aux vols.
// GET /api/admin/fr24-board-test?airport=cdg&hours=0  (hours = décalage en heures par rapport à maintenant, négatif = passé)
const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
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

export async function runFr24BoardTest({airport="cdg",hours=0,page=1,fetchImpl=fetch}={}){
  const ap=clean(airport).toLowerCase().replace(/[^a-z]/g,"").slice(0,4)||"cdg",h=Math.max(-48,Math.min(2,Number(hours)||0)),pg=Math.max(1,Math.min(5,Number(page)||1));
  const date=Math.floor(Date.now()/1000)+Math.round(h*3600),url=`https://www.flightradar24.com/data/airports/${ap}/departures?date=${date}&page=${pg}`;
  const started=Date.now();
  try{
    const r=await fetchImpl(url,{headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":UA},redirect:"manual"});
    const text=await r.text(),ct=clean(r.headers.get("content-type")),ms=Date.now()-started;
    const base={ok:true,mode:"FR24_BOARD_TEST_NO_WRITE",url,httpStatus:r.status,contentType:ct,bytes:text.length,ms,cfMitigated:clean(r.headers.get("cf-mitigated"))};
    if(r.status!==200)return {...base,verdict:r.status===403||r.status===429||r.status===503?"REFUSE":"HTTP_"+r.status,sample:text.slice(0,300)};
    const json=extractDataPage(text);if(!json)return {...base,verdict:/just a moment|cf-chl|verify you are human/i.test(text)?"CHALLENGE_CLOUDFLARE":"PAGE_SANS_DONNEES",sample:text.slice(0,300)}
    const board=parseBoard(json);
    return {...base,verdict:board.total?"OK":"JSON_SANS_VOLS",inertiaVersion:json.version||"",board};
  }catch(e){return {ok:false,mode:"FR24_BOARD_TEST_NO_WRITE",url,verdict:"ERREUR_RESEAU",error:String(e?.message||e).slice(0,200)}}
}
