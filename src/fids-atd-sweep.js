// Source « FIDS flightradar.live » : flux JSON public des départs de CDG, lu en un seul appel (cache 100 s : un appel par passage du cron de 2 min, pause 10 min si refus).
// Son dep_actual est l'heure réelle de départ (12 à 30 min avant le décollage FR24 : c'est l'heure de porte, pas le décollage).
// Utilisé UNIQUEMENT pour l'ATD manquant ; FlightStats / FlightAware, quand ils répondent, le remplacent. Jamais une saisie manuelle.
const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const FEED="https://fids.flightradar.live/api/schedules/departures/CDG",TTL_MS=100000,PAUSE_MS=10*60000;
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
// Avec les horodatages du flux : retard entre -60 min et +24 h, jamais dans le futur ; le décollage connu borne l'ATD le même jour. Sans horodatage, contrôle sur les heures seules (même jour).
export function plausibleActual(row,{std,takeoff,nowMin,nowMs,sameDay}){
  const a=Number(row?.dep_actual_ts),t=Number(row?.dep_time_ts);
  if(a>0&&t>0){const d=(a-t)/60;if(d<-60||d>1440||a*1000>nowMs+60000)return false;return sameDay?plausibleAtd(hhmm(row.dep_actual),{std,takeoff,nowMin:null}):true}
  return sameDay&&plausibleAtd(hhmm(row.dep_actual),{std,takeoff,nowMin});
}
// Vol parti « à l'heure » : le flux le dit parti (active / landed), sans heure réelle, avec une heure estimée identique à la STD, et notre décollage
// (tableau FR24) tombe 5 à 35 min après la STD (le roulage). Dans ce cas seulement, ATD = STD, provisoire : toute autre source qui donne autre chose
// remplace la valeur et met le vol « À CONTRÔLER ».
export function onTimeAtd(row,{std,takeoff,nowMin,date}){
  if(!std||!takeoff||clean(row?.dep_actual))return "";
  if(!["ACTIVE","LANDED"].includes(upper(row?.status)))return "";
  if(!clean(row?.dep_time).startsWith(date)||!clean(row?.dep_estimated).startsWith(date))return "";
  if(hhmm(row.dep_estimated)!==hhmm(row.dep_time)||hhmm(row.dep_time)!==std)return "";
  const s=mins(std),t=mins(takeoff);if(s==null||t==null)return "";
  let d=t-s;if(d<-720)d+=1440;if(d<5||d>35)return "";
  if(nowMin!=null&&s>nowMin+1)return "";
  return std;
}
// Même numéro de vol et même STD ; à défaut, l'unique ligne du même vol (même jour) à ±15 min de notre STD. Lecture seulement : notre STD n'est jamais modifiée.
// ATA du flux : arr_actual (heure locale de la destination), seulement s'il est plausible : pas dans le futur, au moins 20 min et au plus 20 h après le départ,
// et, si notre atterrissage est connu, de 3 à 45 min après lui (une heure égale à l'atterrissage est la piste, pas la porte).
export function ataFromRow(row,x,nowMs){
  const v=hhmm(row?.arr_actual);if(!clean(row?.arr_actual)||!v)return "";
  const a=Number(row.arr_actual_ts),d=Number(row.dep_actual_ts)||Number(row.dep_time_ts);
  if(!(a>0)||a*1000>nowMs+60000)return "";
  if(d>0){const dur=(a-d)/60;if(dur<20||dur>1200)return ""}
  const l=mins(hhmm(x?.landing)),m=mins(v);
  if(l!=null&&m!=null){let g=m-l;if(g<-720)g+=1440;if(g>720)g-=1440;if(g<3||g>45)return ""}
  return v;
}
// ETA du flux : arr_estimated (heure locale de la destination) dès qu'elle est mentionnée, vol parti ou non, en retard ou non, tant que le vol n'est pas posé. Rejetée seulement si elle est incohérente avec le départ.
export function etaFromRow(row,x,nowMs){
  const v=hhmm(row?.arr_estimated);if(!clean(row?.arr_estimated)||!v)return "";
  if(clean(x?.ata)||clean(x?.landing))return "";
  const e=Number(row.arr_estimated_ts),d=Number(row.dep_actual_ts)||Number(row.dep_estimated_ts)||Number(row.dep_time_ts);
  if(e>0){if(d>0){const dur=(e-d)/60;if(dur<20||dur>1200)return ""}}
  return v;
}
// ETD du flux : dep_estimated (heure locale de CDG) pour un vol pas encore parti. Rejetée si hors du même jour ou incohérente avec l'horaire programmé du flux
// (de -60 min à +24 h). Sans information de retard (estimation = STD) et sans ETD chez nous, rien n'est écrit. Notre STD n'est jamais modifiée.
export function etdFromRow(row,x,{std,date}={}){
  const v=hhmm(row?.dep_estimated);if(!clean(row?.dep_estimated)||!v)return "";
  if(date&&!clean(row.dep_estimated).startsWith(date))return "";
  if(clean(x?.atd)||clean(x?.takeoff)||clean(x?.landing)||clean(x?.ata))return "";
  // Le flux a déjà l'heure réelle de départ : son dep_estimated vaut alors l'heure réelle, pas une estimation. On garde le dernier ETD d'avant le départ.
  if(clean(row?.dep_actual))return "";
  const e=Number(row.dep_estimated_ts),s=Number(row.dep_time_ts);
  if(e>0&&s>0){const d=(e-s)/60;if(d<-60||d>1440)return ""}
  if(v===std&&!clean(x?.etd||x?.edt))return "";
  return v;
}
export function pickFeedRow(index,{designator,std},tolerance=15){
  const rows=index.get(upper(designator))||[],prefer=(a,b)=>(upper(b.flight_iata)===upper(designator))-(upper(a.flight_iata)===upper(designator));
  const exact=rows.filter(r=>hhmm(r.dep_time)===std).sort(prefer)[0];
  if(exact||!tolerance)return exact||null;
  const s=mins(std);if(s==null)return null;
  const near=rows.filter(r=>{const m=mins(hhmm(r.dep_time));if(m==null)return false;let d=Math.abs(m-s);d=Math.min(d,1440-d);return d<=tolerance});
  return new Set(near.map(r=>hhmm(r.dep_time))).size===1?near.sort(prefer)[0]:null;
}

export async function sweepFidsToday(env,{fetchImpl=fetch,nowMs=Date.now(),dryRun=false}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const feed=await getFeed({fetchImpl,nowMs});
  if(!feed.rows){const out={ok:true,status:feed.status,updated:0};if(!dryRun)await saveFidsState(env,{status:feed.status,http:feed.httpStatus||0,flights:{}},nowMs);return out}
  const today=parisDate(nowMs),yesterday=parisDate(nowMs-86400000),nowMin=parisMinutes(nowMs),at=new Date(nowMs).toISOString();
  let matched=0,updated=0,rejected=0,flightsSeen=0,ataUpdated=0,etaUpdated=0,etdUpdated=0;const per={};
  // Aujourd'hui, et hier : un vol d'hier soir retardé après minuit reçoit son ATD aujourd'hui (la date du vol reste celle d'hier, la STD n'est jamais modifiée).
  for(const date of [today,yesterday]){
    const index=indexFeed(feed.rows,date);
    const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_number,airline,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();
    flightsSeen+=results.length;
    for(const r of results){
      let x={};try{x=JSON.parse(r.data_json||"{}")}catch{continue}
      if(upper(x.origin||"CDG")!=="CDG")continue;
      const airline=upper(x.airline||r.airline),flight=upper(x.flight||r.flight_number),designator=flight.startsWith(airline)?flight:airline+String(r.flight_number||"").replace(/^[A-Z0-9]{2,3}(?=\d)/,"");
      const std=hhmm(x.std||r.std),row=pickFeedRow(index,{designator,std}),key=designator+"|"+std,isToday=date===today;
      if(!row){if(isToday)per[key]="NOT_TRACKED";continue}
      matched++;const act=clean(row.dep_actual);if(isToday)per[key]=act?"OK":"NO_USABLE_DATA";
      let changed=false;
      // ATA : heure d'arrivée réelle du flux (heure locale de la destination), provisoire.
      {const ata=ataFromRow(row,x,nowMs);
        if(ata&&clean(x.ata)!==ata&&!manual(x,"ata")&&(!clean(x.ata)||/FIDS/.test(upper(x.ataSource)))){
          const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:"PUBLIC_LIVE:FIDS",field:"ata",from:clean(x.ata),to:ata});
          x.flightInfoLog=log.slice(0,240);x.ata=ata;x.ataSource="PUBLIC_LIVE:FIDS";x.ataUpdatedAt=at;ataUpdated++;changed=true}}
      // ETA : estimation du flux, provisoire ; ne remplace ni une saisie manuelle ni une ETA FlightStats / FR24 ; elle remplace une ETA FlightAware (écart d'1 h constaté vers ALG / CMN).
      {const eta=etaFromRow(row,x,nowMs);
        if(eta&&clean(x.eta)!==eta&&!manual(x,"eta")&&(!clean(x.eta)||/FIDS|FLIGHTAWARE/.test(upper(x.etaSource)))){
          const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:"PUBLIC_LIVE:FIDS",field:"eta",from:clean(x.eta),to:eta});
          x.flightInfoLog=log.slice(0,240);x.eta=eta;x.etaSource="PUBLIC_LIVE:FIDS";x.etaUpdatedAt=at;etaUpdated++;changed=true}}
      // ETD : estimation du flux, prioritaire sur les ETD FR24 (tableau / par vol) ; jamais une saisie manuelle.
      {const etd=etdFromRow(row,x,{std,date});
        if(etd&&hhmm(x.etd||x.edt)!==etd&&!manual(x,"etd")){
          const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:"PUBLIC_LIVE:FIDS",field:"etd",from:clean(x.etd||x.edt),to:etd});
          x.flightInfoLog=log.slice(0,240);x.etd=etd;x.edt=etd;x.etdSource="PUBLIC_LIVE:FIDS";x.etdUpdatedAt=at;x.etdTimeBasis="CDG_LOCAL";etdUpdated++;changed=true}}
      const atdStep=()=>{
        let atd=act?hhmm(act):"",onTime=false;
        if(!atd&&isToday&&!clean(x.atd)&&!manual(x,"atd")){atd=onTimeAtd(row,{std,takeoff:hhmm(x.takeoff),nowMin,date});onTime=Boolean(atd);if(onTime)per[key]="OK"}
        if(!atd)return false;
        if(manual(x,"atd")||(clean(x.atd)&&!/FIDS/.test(upper(x.atdSource))))return false;
        if(clean(x.atd)===atd)return false;
        if(!onTime&&!plausibleActual(row,{std,takeoff:act.startsWith(date)?hhmm(x.takeoff):"",nowMin,nowMs,sameDay:act.startsWith(date)})){rejected++;return false}
        const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:onTime?"PUBLIC_LIVE:FIDS_ONTIME":"PUBLIC_LIVE:FIDS",field:"atd",from:clean(x.atd),to:atd});
        x.flightInfoLog=log.slice(0,240);x.atd=atd;x.atdSource=onTime?"PUBLIC_LIVE:FIDS_ONTIME":"PUBLIC_LIVE:FIDS";x.atdUpdatedAt=at;delete x.atdConflict;updated++;return true};
      if(atdStep())changed=true;
      if(changed&&!dryRun)await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),r.identity).run();
    }
  }
  if(!dryRun)await saveFidsState(env,{status:"OK",http:200,flights:per},nowMs);
  return {ok:true,status:"OK",date:today,flights:flightsSeen,matched,updated,ataUpdated,etaUpdated,etdUpdated,rejected};
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
