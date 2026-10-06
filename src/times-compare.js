// Comparaison LECTURE SEULE des heures prévisionnelles (ETD, ETA) entre nos valeurs, le tableau FR24 de CDG, le flux FIDS et FR24 par vol. N'écrit rien.
// GET /api/admin/times-compare?limit=12&offset=0 : vols du jour pas encore arrivés, triés par STD ; une lecture FR24 par vol (3 en parallèle).
import {getBoard,matchRow} from "./fr24-board.js";
import {getFeed,indexFeed,pickFeedRow} from "./fids-atd-sweep.js";
import {fetchFr24Public} from "./fr24-public-html.js";
import {AIRPORT_TZ} from "./airport-tz.js";

const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})\s*$/)||clean(v).match(/(\d{1,2}):(\d{2})/);return m?String(m[1]).padStart(2,"0")+":"+m[2]:""};
const mins=h=>{const m=/^(\d{2}):(\d{2})$/.exec(h||"");return m?+m[1]*60+ +m[2]:null};
const parisDate=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));
const clockOf=(secOrIso,zone)=>{const d=typeof secOrIso==="number"?new Date(secOrIso*1000):new Date(secOrIso);if(!Number.isFinite(d.getTime())||!secOrIso)return "";try{const p=Object.fromEntries(new Intl.DateTimeFormat("fr-FR",{timeZone:zone||"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d).map(x=>[x.type,x.value]));return `${p.hour}:${p.minute}`}catch{return ""}};

// Écart maximal (minutes, circulaire sur 24 h) entre les valeurs renseignées ; drapeau au-delà du seuil.
export function spread(values,threshold=5){
  const v=Object.entries(values).filter(([,x])=>mins(x)!=null);
  let max=0;
  for(const [,a] of v)for(const [,b] of v){let d=Math.abs(mins(a)-mins(b));d=Math.min(d,1440-d);if(d>max)max=d}
  return {sources:v.length,maxGap:max,flag:v.length>=2&&max>threshold};
}
async function mapLimit(items,limit,fn){const out=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{for(;;){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i])}}));return out}

export async function runTimesCompare(env,{limit=12,offset=0,all=false,nowMs=Date.now(),fetchImpl=fetch,fr24=fetchFr24Public}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const date=parisDate(nowMs),at=new Date(nowMs).toISOString();
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,flight_number,airline,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS' ORDER BY std,flight_number`).bind(date).all();
  const flights=[];
  for(const r of results){let x={};try{x=JSON.parse(r.data_json||"{}")}catch{continue}
    if(upper(x.origin||"CDG")!=="CDG"||clean(x.ata)||upper(x.status).includes("ANNUL"))continue;
    const airline=upper(x.airline||r.airline),designator=upper(x.flight||r.flight_number),number=designator.startsWith(airline)?designator.slice(airline.length):String(r.flight_number||"").replace(/^[A-Z0-9]{2,3}(?=\d)/,"");
    flights.push({date,airline,number,designator,origin:"CDG",destination:upper(x.destination||x.dest||""),std:hhmm(x.std||r.std),raw:x});
  }
  // Par défaut : vols dont la STD est dans les 3 dernières heures ou à venir (la fenêtre du tableau FR24 et du flux FIDS) ; all=1 pour tous.
  const nowParis=(()=>{const p=Object.fromEntries(new Intl.DateTimeFormat("fr-FR",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(nowMs)).map(x=>[x.type,x.value]));return +p.hour*60+ +p.minute})();
  const inWindow=all?flights:flights.filter(f=>{const m=mins(f.std);return m==null||m>=nowParis-180});
  const slice=inWindow.slice(Math.max(0,offset),Math.max(0,offset)+Math.min(25,Math.max(1,limit)));
  const board=await getBoard({fetchImpl,nowMs}),feed=await getFeed({fetchImpl,nowMs}),fidsIndex=feed.rows?indexFeed(feed.rows,date):new Map();
  const rows=await mapLimit(slice,3,async f=>{
    const x=f.raw,zoneDest=AIRPORT_TZ[f.destination]||"Europe/Paris";
    const b=board.index?matchRow(board.index,f):null,fd=pickFeedRow(fidsIndex,{designator:f.designator,std:f.std});
    let s={};try{const r=await fr24(f);s=r?.candidates?.semantic||{}}catch{}
    const etd={ours:hhmm(x.etd||x.edt),oursSource:clean(x.etdSource),board:b?clockOf(b.time,"Europe/Paris"):"",fids:hhmm(fd?.dep_estimated),fr24:s.etd?clockOf(s.etd,"Europe/Paris"):""};
    const eta={ours:hhmm(x.eta),oursSource:clean(x.etaSource),fids:hhmm(fd?.arr_estimated),fr24:s.eta?clockOf(s.eta,zoneDest):""};
    const departed=Boolean(clean(x.atd)||clean(x.takeoff));
    return {flight:f.designator,std:f.std,dest:f.destination,departed,etd:{...etd,...spread({ours:etd.ours,board:etd.board,fids:etd.fids,fr24:etd.fr24})},eta:{...eta,...spread({ours:eta.ours,fids:eta.fids,fr24:eta.fr24})}};
  });
  const sum=k=>({compared:rows.filter(r=>r[k].sources>=2).length,flagged:rows.filter(r=>r[k].flag).length});
  // Pour l'ETD, seuls les vols pas encore partis comptent (après le départ l'ETD n'a plus d'enjeu).
  const etdRows=rows.filter(r=>!r.departed);
  return {ok:true,mode:"TIMES_COMPARE_NO_WRITE",date,at,statuses:{board:board.status,fids:feed.status},eligible:inWindow.length,windowFrom:all?null:Math.max(0,nowParis-180),read:rows.length,offset,
    etd:{compared:etdRows.filter(r=>r.etd.sources>=2).length,flagged:etdRows.filter(r=>r.etd.flag).length},eta:sum("eta"),
    flaggedFlights:rows.filter(r=>(!r.departed&&r.etd.flag)||r.eta.flag),rows};
}
