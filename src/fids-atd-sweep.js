// Source « FIDS flightradar.live » : flux JSON public des départs de CDG, lu en un seul appel (cache 8 min, pause 10 min si refus).
// Son dep_actual est l'heure réelle de départ (12 à 30 min avant le décollage FR24 : c'est l'heure de porte, pas le décollage).
// Utilisé UNIQUEMENT pour l'ATD manquant ; FlightStats / FlightAware, quand ils répondent, le remplacent. Jamais une saisie manuelle.
const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const FEED="https://fids.flightradar.live/api/schedules/departures/CDG",TTL_MS=8*60000,PAUSE_MS=10*60000;
const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})\s*$/);return m?String(m[1]).padStart(2,"0")+":"+m[2]:""};
const mins=h=>{const m=/^(\d{2}):(\d{2})$/.exec(h||"");return m?+m[1]*60+ +m[2]:null};
const parisDate=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));
const parisMinutes=ms=>{const p=Object.fromEntries(new Intl.DateTimeFormat("fr-FR",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));return +p.hour*60+ +p.minute};
const manual=(x,f)=>upper(x?.[f+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[f]||x?.manualOverrides?.[f]||x?.manual_fields?.[f]);
let cache=null,pausedUntil=0;

export function indexFeed(rows,date){
  const m=new Map();
  for(const r of Array.isArray(rows)?rows:[]){
    if(!clean(r?.dep_time).startsWith(date))continue;
    for(const k of [upper(r.flight_iata),upper(r.cs_flight_iata)]){if(!k)continue;if(!m.has(k))m.set(k,[]);m.get(k).push(r)}
  }
  return m;
}
export async function getFeed({fetchImpl=fetch,nowMs=Date.now()}={}){
  if(nowMs<pausedUntil)return {status:"COOLDOWN",rows:null};
  if(cache&&nowMs-cache.at<TTL_MS)return {status:"OK",rows:cache.rows};
  try{
    const r=await fetchImpl(FEED,{headers:{accept:"application/json","user-agent":UA,referer:"https://flightradar.live/"},redirect:"follow"});
    if(r.status!==200){if([403,429,503].includes(r.status))pausedUntil=nowMs+PAUSE_MS;return {status:r.status===403||r.status===429?"BLOCKED":"HTTP_ERROR",httpStatus:r.status,rows:null}}
    const rows=await r.json();if(!Array.isArray(rows)||!rows.length){pausedUntil=nowMs+2*60000;return {status:"EMPTY",rows:null}}
    cache={at:nowMs,rows};return {status:"OK",rows};
  }catch{pausedUntil=nowMs+2*60000;return {status:"FETCH_ERROR",rows:null}}
}
// ATD du flux accepté seulement s'il est plausible : pas dans le futur, pas plus de 60 min avant la STD, pas après le décollage connu.
export function plausibleAtd(atd,{std,takeoff,nowMin}){
  const a=mins(atd),s=mins(std);if(a==null)return false;
  if(nowMin!=null&&a>nowMin+1)return false;
  if(s!=null){let d=a-s;if(d>720)d-=1440;if(d<-720)d+=1440;if(d<-60)return false}
  const t=mins(takeoff);if(t!=null&&a>t)return false;
  return true;
}
export function pickFeedRow(index,{designator,std}){return (index.get(upper(designator))||[]).filter(r=>hhmm(r.dep_time)===std).sort((a,b)=>(upper(b.flight_iata)===upper(designator))-(upper(a.flight_iata)===upper(designator)))[0]||null}

export async function sweepFidsToday(env,{fetchImpl=fetch,nowMs=Date.now(),dryRun=false}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const feed=await getFeed({fetchImpl,nowMs});
  if(!feed.rows){const out={ok:true,status:feed.status,updated:0};if(!dryRun)await saveFidsState(env,{status:feed.status,http:feed.httpStatus||0,flights:{}},nowMs);return out}
  const date=parisDate(nowMs),nowMin=parisMinutes(nowMs),index=indexFeed(feed.rows,date),at=new Date(nowMs).toISOString();
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_number,airline,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();
  let matched=0,updated=0,rejected=0;const per={};
  for(const r of results){
    let x={};try{x=JSON.parse(r.data_json||"{}")}catch{continue}
    if(upper(x.origin||"CDG")!=="CDG")continue;
    const airline=upper(x.airline||r.airline),flight=upper(x.flight||r.flight_number),designator=flight.startsWith(airline)?flight:airline+String(r.flight_number||"").replace(/^[A-Z0-9]{2,3}(?=\d)/,"");
    const std=hhmm(x.std||r.std),row=pickFeedRow(index,{designator,std}),key=designator+"|"+std;if(!row){per[key]="NOT_TRACKED";continue}matched++;per[key]=clean(row.dep_actual).startsWith(date)?"OK":"NO_USABLE_DATA";
    const atd=clean(row.dep_actual)&&clean(row.dep_actual).startsWith(date)?hhmm(row.dep_actual):"";if(!atd)continue;
    if(manual(x,"atd")||(clean(x.atd)&&!/FIDS/.test(upper(x.atdSource))))continue;
    if(clean(x.atd)===atd)continue;
    if(!plausibleAtd(atd,{std,takeoff:hhmm(x.takeoff),nowMin})){rejected++;continue}
    const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:"PUBLIC_LIVE:FIDS",field:"atd",from:clean(x.atd),to:atd});
    x.flightInfoLog=log.slice(0,240);x.atd=atd;x.atdSource="PUBLIC_LIVE:FIDS";x.atdUpdatedAt=at;updated++;
    if(!dryRun)await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),r.identity).run();
  }
  if(!dryRun)await saveFidsState(env,{status:"OK",http:200,flights:per},nowMs);
  return {ok:true,status:"OK",date,flights:results.length,matched,updated,rejected};
}

// État de la dernière lecture, gardé dans ops_meta pour le bilan ADMIN (une ligne, réécrite seulement si elle change ou toutes les 10 min).
const STATE_KEY="fids_state_v1";let lastState="",lastStateAt=0;
export async function saveFidsState(env,state,nowMs=Date.now()){
  try{
    const body=JSON.stringify(state);if(body===lastState&&nowMs-lastStateAt<10*60000)return false;
    await env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS ops_meta(k TEXT PRIMARY KEY,v TEXT)`).run();
    await env.OPS_DB.prepare(`INSERT INTO ops_meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(STATE_KEY,JSON.stringify({at:new Date(nowMs).toISOString(),...state})).run();
    lastState=body;lastStateAt=nowMs;return true;
  }catch{return false}
}
export async function loadFidsState(env){
  try{const row=await env.OPS_DB.prepare(`SELECT v FROM ops_meta WHERE k=?`).bind(STATE_KEY).first();return row?.v?JSON.parse(row.v):null}catch{return null}
}
// Lecture FIDS d'un vol pour le bilan : même forme qu'une tentative de source.
export function fidsAttempt(state,flight,std){
  if(!state)return null;
  const at=state.at||"";
  if(state.status!=="OK")return {source:"FIDS",status:state.status==="BLOCKED"?"BLOCKED":state.status==="COOLDOWN"?"COOLDOWN":"HTTP_ERROR",httpStatus:state.http||0,checkedAt:at};
  const st=state.flights?.[upper(flight)+"|"+std];
  return {source:"FIDS",status:st||"NOT_TRACKED",httpStatus:200,checkedAt:at};
}
