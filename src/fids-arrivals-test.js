// Diagnostic LECTURE SEULE : flux d'arrivées de FIDS (flightradar.live) pour des aéroports de destination. N'écrit rien.
// GET /api/admin/fids-arrivals-test?iata=ALG,IST,TLV : taille, fenêtre, lignes avec heure réelle d'arrivée, et lignes venant de CDG.
const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})\s*$/);return m?String(m[1]).padStart(2,"0")+":"+m[2]:""};

export function summariseArrivals(rows){
  const a=Array.isArray(rows)?rows:[],fromCdg=a.filter(r=>upper(r?.dep_iata)==="CDG"),times=a.map(r=>clean(r?.arr_time)).filter(Boolean).sort();
  const filled=k=>a.filter(r=>clean(r?.[k])!=="").length;
  return {rows:a.length,window:{first:times[0]||null,last:times[times.length-1]||null},arrActual:filled("arr_actual"),arrEstimated:filled("arr_estimated"),depActual:filled("dep_actual"),
    fromCdg:{rows:fromCdg.length,arrActual:fromCdg.filter(r=>clean(r.arr_actual)).length,depActual:fromCdg.filter(r=>clean(r.dep_actual)).length,
      sample:fromCdg.filter(r=>clean(r.arr_actual)).slice(0,6).map(r=>({flight:r.flight_iata,dep_time:hhmm(r.dep_time),dep_actual:hhmm(r.dep_actual),arr_time:hhmm(r.arr_time),arr_estimated:hhmm(r.arr_estimated),arr_actual:hhmm(r.arr_actual),arr_gate:r.arr_gate||"",status:r.status}))}};
}
export async function runFidsArrivalsTest({iata="",fetchImpl=fetch}={}){
  const codes=[...new Set(String(iata||"").split(",").map(s=>upper(s).replace(/[^A-Z]/g,"")).filter(s=>s.length===3))].slice(0,4);
  if(!codes.length)return {ok:false,error:"iata=ALG,IST,… requis (4 aéroports au plus)"};
  const out=[];
  for(const c of codes){
    const url=`https://fids.flightradar.live/api/schedules/arrivals/${c}`;
    try{const r=await fetchImpl(url,{headers:{accept:"application/json","user-agent":UA,referer:"https://flightradar.live/"},redirect:"follow"});const text=await r.text();
      let rows=null;try{rows=JSON.parse(text)}catch{}
      out.push({iata:c,url,httpStatus:r.status,bytes:text.length,...(Array.isArray(rows)?summariseArrivals(rows):{note:clean(text).slice(0,150)})})}
    catch(e){out.push({iata:c,url,error:String(e?.message||e).slice(0,100)})}
  }
  return {ok:true,mode:"FIDS_ARRIVALS_TEST_NO_WRITE",airports:out};
}
