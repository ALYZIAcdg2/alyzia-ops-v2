// Page FIDS d'un vol (fids.flightradar.live/flight-status/{vol}/{départ}/{arrivée}/{aaaammjjhhmm de la STD locale}) : ATD et ATA réels pour les vols qui ne sont plus dans le flux général (fenêtre ~3 h).
// Lecture seulement, 4 vols au plus par passage du cron ; STD/STA ne sont jamais modifiées, une saisie manuelle n'est jamais écrasée.
// ATA : seulement si vide, calculée (LDG + 10) ou déjà du FIDS. ATD : seulement si vide, « parti à l'heure » ou premier mouvement FR24.
import {tzOffsetMinutes} from "./airport-tz.js";
const BASE="https://fids.flightradar.live/flight-status",MAX_PER_RUN=6,FETCH_TIMEOUT_MS=4000,RETRY_MS=10*60000,OVERDUE_RETRY_MS=4*60000,MAX_AGE_H=6;
const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})/);return m?m[1].padStart(2,"0")+":"+m[2]:""};
const mins=v=>{const m=hhmm(v).match(/(\d+):(\d+)/);return m?Number(m[1])*60+Number(m[2]):null};
const manual=(x,f)=>upper(x?.[f+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[f]||x?.manualOverrides?.[f]||x?.manual_fields?.[f]);
const parisDate=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));
const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";   // mêmes en-têtes que la lecture du flux FIDS général
const tried=new Map(),GONE_MS=3*3600000;   // 404 / 410 : la page du vol n'existe plus, inutile de la relire avant longtemps
export function flightPageUrl({flight,origin="CDG",dest,date,std}){
  const s=hhmm(std);if(!flight||!dest||!date||!s)return "";
  return `${BASE}/${encodeURIComponent(upper(flight))}/${upper(origin)}/${upper(dest)}/${date.replace(/-/g,"")}${s.replace(":","")}`;
}
// Heures « Actual » des deux blocs Departure / Arrival (heure locale de chaque aéroport). Vide si le bloc n'a pas d'heure réelle.
export function parseFlightPage(html){
  const t=String(html||"");if(!/Flight Departure Times/.test(t))return null;
  const i=t.indexOf("Flight Arrival Times"),dep=i<0?t:t.slice(0,i),arr=i<0?"":t.slice(i);
  const act=b=>{const m=b.match(/Actual<br\s*\/?>\s*<strong[^>]*>\s*(\d{1,2}:\d{2})/i);return m?hhmm(m[1]):""};
  const st=(t.match(/class="board__header-status[^"]*"[^>]*>\s*([^<]+?)\s*</)||[])[1]||"";
  return {status:clean(st).toLowerCase(),atd:act(dep),ata:act(arr)};
}
// ATA de la page : heure « Actual » d'arrivée (heure locale de la destination). Plausible si, avec l'atterrissage connu, elle tombe de 3 à 45 min après lui ;
// sans atterrissage connu, si le temps depuis le décollage (heures converties en UTC) est de 20 min à 20 h.
export function pageAta(p,x,nowMs=Date.now()){
  const v=p?.ata;if(!v)return "";
  const l=mins(x?.landing),m=mins(v);
  if(l!=null&&m!=null){let g=m-l;if(g<-720)g+=1440;if(g>720)g-=1440;if(g<3||g>45)return "";return v}
  const t=mins(x?.takeoff);
  if(t!=null&&m!=null){
    const now=new Date(nowMs),oOff=Number(tzOffsetMinutes(upper(x?.origin||"CDG"),now))||0,dOff=Number(tzOffsetMinutes(upper(x?.destination||x?.dest),now))||0;
    let dur=((m-dOff)-(t-oOff))%1440;if(dur<0)dur+=1440;if(dur<20||dur>1200)return "";
  }
  return v;
}
export function pageAtd(p,x){
  const v=p?.atd;if(!v)return "";
  const t=mins(x?.takeoff),m=mins(v);
  if(t!=null&&m!=null){let g=t-m;if(g<-720)g+=1440;if(g>720)g-=1440;if(g<1||g>90)return ""}
  return v;
}
const ataOpen=x=>!clean(x.ata)||/DERIVED|FIDS/.test(upper(x.ataSource));
const atdOpen=x=>!clean(x.atd)||/FIDS_ONTIME|FR24MOVE/.test(upper(x.atdSource));
export function wantsPage(x,nowMs){
  if(upper(x.origin||"CDG")!=="CDG"||!clean(x.destination||x.dest))return false;
  if(!clean(x.landing)&&!clean(x.takeoff))return false;
  // ATA : vol décollé ou posé sans ATA réelle (vide, calculée, ou déjà du FIDS à confirmer). Avant, il fallait un atterrissage connu : un vol décollé dont l'atterrissage manque (AH1115, AH1543, AH1083, AH1013) n'était jamais lu.
  return (!manual(x,"ata")&&ataOpen(x)&&!/^PUBLIC_LIVE:FIDS$/.test(upper(x.ataSource)))||(clean(x.takeoff)&&!manual(x,"atd")&&atdOpen(x));
}
export async function sweepFidsFlightPages(env,{fetchImpl=fetch,nowMs=Date.now(),dryRun=false,only=""}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const today=parisDate(nowMs),yesterday=parisDate(nowMs-86400000),at=new Date(nowMs).toISOString();
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,airline,flight_number,std,data_json FROM flights WHERE flight_date IN (?,?) AND airline<>'SYS'`).bind(today,yesterday).all();
  const cand=[];
  for(const r of results){let x={};try{x=JSON.parse(r.data_json||"{}")}catch{continue}
    if(!wantsPage(x,nowMs))continue;
    // Vol d'hier : sa page a disparu (410) sauf s'il est parti après minuit ; seuls les départs de 20 h ou plus sont relus.
    if(r.flight_date<today&&(mins(x.std||r.std)??0)<20*60)continue;
    if(only&&!upper(x.flight||r.flight_number).includes(upper(only)))continue;
    {const a=Date.parse(clean(x.statusArrivalUtc)),late=Number.isFinite(a)&&nowMs-a>=15*60000&&!clean(x.ata);if(!dryRun&&nowMs-(tried.get(r.identity)||0)<(late?OVERDUE_RETRY_MS:RETRY_MS))continue}
    cand.push({r,x})}
  // Les vols dont l'ETA est dépassée (sans ATA) d'abord, les plus récemment dépassés en tête ; puis ceux du jour, puis les moins récemment lus.
  const over=c=>{const a=Date.parse(clean(c.x.statusArrivalUtc));const o=Number.isFinite(a)?(nowMs-a)/60000:-1;return !clean(c.x.ata)&&o>=15?o:-1};
  cand.sort((a,b)=>{const oa=over(a),ob=over(b);if((oa>=0)!==(ob>=0))return oa>=0?-1:1;if(oa>=0&&ob>=0&&oa!==ob)return oa-ob;return (b.r.flight_date<a.r.flight_date?-1:b.r.flight_date>a.r.flight_date?1:0)||(tried.get(a.r.identity)||0)-(tried.get(b.r.identity)||0)});
  const done=[],checked=[];
  // Lectures en parallèle et bornées à 4 s : cette étape ne doit jamais retarder le traitement principal des vols (statuts, ATD, décollage).
  const batch=cand.slice(0,MAX_PER_RUN);
  const pages=await Promise.all(batch.map(async({r,x})=>{
    if(!dryRun)tried.set(r.identity,nowMs);
    const flight=upper(x.flight)||upper(x.airline||r.airline)+clean(r.flight_number).replace(/^[A-Z0-9]{2,3}(?=\d)/,"");
    const url=flightPageUrl({flight,dest:x.destination||x.dest,date:r.flight_date,std:x.std||r.std});
    if(!url)return null;
    let p=null,http=0,err="";
    try{const res=await fetchImpl(url,{headers:{accept:"text/html,*/*","user-agent":UA,referer:"https://flightradar.live/"},redirect:"follow",signal:AbortSignal.timeout(FETCH_TIMEOUT_MS)});http=res.status;if(res.ok)p=parseFlightPage(await res.text())}catch(e){err=String(e?.message||e)}
    if(!dryRun&&(http===404||http===410))tried.set(r.identity,nowMs+GONE_MS-RETRY_MS);
    return {r,x,flight,url,http,err,p};
  }));
  for(const pg of pages){
    if(!pg)continue;const {r,x,flight,url,http,err,p}=pg;
    checked.push({flight,url,http,err,parsed:p});if(!p)continue;
    let changed=false;const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];
    const ata=pageAta(p,x,nowMs);
    if(ata&&!manual(x,"ata")&&ataOpen(x)&&clean(x.ata)!==ata){log.unshift({at,source:"PUBLIC_LIVE:FIDS",field:"ata",from:clean(x.ata),to:ata});x.ata=ata;x.ataSource="PUBLIC_LIVE:FIDS";x.ataUpdatedAt=at;changed=true}
    const atd=pageAtd(p,x);
    if(atd&&!manual(x,"atd")&&atdOpen(x)&&clean(x.atd)!==atd){log.unshift({at,source:"PUBLIC_LIVE:FIDS",field:"atd",from:clean(x.atd),to:atd});x.atd=atd;x.atdSource="PUBLIC_LIVE:FIDS";x.atdUpdatedAt=at;delete x.atdConflict;changed=true}
    if(!changed)continue;
    x.flightInfoLog=log.slice(0,240);
    if(!dryRun)await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),r.identity).run();
    done.push({flight,ata:x.ata,atd:x.atd});
  }
  if(!dryRun&&checked.length)await saveLastRun(env,{at,candidates:cand.length,updated:done.length,checked:checked.map(c=>({flight:c.flight,http:c.http,err:c.err,ata:c.parsed?.ata||"",atd:c.parsed?.atd||""}))});
  return {ok:true,candidates:cand.length,checked,updated:done.length,items:done};
}
// Dernier passage réel du cron (le diagnostic à blanc tourne dans une autre requête et ne prouve pas ce que le cron a pu lire).
const KEY="fids_flight_page_v1";
async function saveLastRun(env,state){try{
  await env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS ops_meta(k TEXT PRIMARY KEY,v TEXT)`).run();
  await env.OPS_DB.prepare(`INSERT INTO ops_meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(KEY,JSON.stringify(state)).run();
}catch{}}
export async function loadLastRun(env){try{const r=await env.OPS_DB.prepare(`SELECT v FROM ops_meta WHERE k=?`).bind(KEY).first();return r?.v?JSON.parse(r.v):null}catch{return null}}
export function _resetFlightPageMemo(){tried.clear()}
