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
    if(r.status!==200){if([403,429,503].includes(r.status))pausedUntil=nowMs+PAUSE_MS;return {status:"HTTP_"+r.status,rows:null}}
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
  const feed=await getFeed({fetchImpl,nowMs});if(!feed.rows)return {ok:true,status:feed.status,updated:0};
  const date=parisDate(nowMs),nowMin=parisMinutes(nowMs),index=indexFeed(feed.rows,date),at=new Date(nowMs).toISOString();
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_number,airline,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();
  let matched=0,updated=0,rejected=0;
  for(const r of results){
    let x={};try{x=JSON.parse(r.data_json||"{}")}catch{continue}
    if(upper(x.origin||"CDG")!=="CDG")continue;
    const airline=upper(x.airline||r.airline),flight=upper(x.flight||r.flight_number),designator=flight.startsWith(airline)?flight:airline+String(r.flight_number||"").replace(/^[A-Z0-9]{2,3}(?=\d)/,"");
    const std=hhmm(x.std||r.std),row=pickFeedRow(index,{designator,std});if(!row)continue;matched++;
    const atd=clean(row.dep_actual)&&clean(row.dep_actual).startsWith(date)?hhmm(row.dep_actual):"";if(!atd)continue;
    if(manual(x,"atd")||(clean(x.atd)&&!/FIDS/.test(upper(x.atdSource))))continue;
    if(clean(x.atd)===atd)continue;
    if(!plausibleAtd(atd,{std,takeoff:hhmm(x.takeoff),nowMin})){rejected++;continue}
    const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:"PUBLIC_LIVE:FIDS",field:"atd",from:clean(x.atd),to:atd});
    x.flightInfoLog=log.slice(0,240);x.atd=atd;x.atdSource="PUBLIC_LIVE:FIDS";x.atdUpdatedAt=at;updated++;
    if(!dryRun)await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),r.identity).run();
  }
  return {ok:true,status:"OK",date,flights:results.length,matched,updated,rejected};
}
