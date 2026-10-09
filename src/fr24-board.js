// Source "FR24 tableau CDG" : le tableau public des départs de CDG (100 vols par page, 5 pages = 500 vols à partir de 3 h avant) lu en lot, au lieu d'une lecture par vol.
// Donne : heure de décollage (vols « departed ») ou ETD (vols pas encore partis), porte, immatriculation, type d'avion et identifiant FR24 du vol.
// Cache 8 min partagé par tous les vols d'un passage ; en cas de refus (403/429/409/challenge) la source se met en pause 10 min.
import {extractDataPage,parseBoard} from "./fr24-board-parse.js";
import {flightLookupVariants} from "./public-flight-alias.js";

const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const TTL_MS=8*60000,PAUSE_MS=10*60000,BACK_H=3,PAGES=5;
const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
let cache=null,pausedUntil=0,inflight=null,lastHttp=0;

const parisClock=sec=>{if(!sec)return"";const p=new Intl.DateTimeFormat("fr-FR",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(sec*1000)),m=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${m.hour}:${m.minute}`};
export const parisDay=sec=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(sec*1000));

// Un même numéro de vol peut partir deux fois dans la journée (TU441, EC4541) : on garde toutes les lignes par numéro.
// Un vol sans numéro commercial (charter) est listé par son indicatif (ENT9ZW) : la ligne est donc aussi classée sous son indicatif.
export function indexRows(rows){const m=new Map();const add=(k,r)=>{if(!k)return;if(!m.has(k))m.set(k,[]);const l=m.get(k);if(!l.includes(r))l.push(r)};for(const r of rows){add(upper(r.flight),r);add(upper(r.callsign),r)}return m}
// Ligne du tableau pour ce vol : même numéro (ou variante IATA/OACI), même date et même heure prévue (STD).
export function matchRow(index,f){
  const keys=[upper(f.designator),...flightLookupVariants({airline:f.airline,number:f.number}).map(v=>upper(v.airline)+upper(v.number))];
  for(const k of keys){for(const r of index.get(k)||[]){if((!f.date||parisDay(r.std)===f.date)&&(!f.std||parisClock(r.std)===f.std))return r}}
  // À défaut : l'unique ligne du même vol (même jour) à ±15 min de notre STD. Lecture seulement, notre STD n'est jamais modifiée.
  const mm=h=>{const m=/^(\d{2}):(\d{2})$/.exec(h||"");return m?+m[1]*60+ +m[2]:null},s=mm(f.std);
  if(s!=null){
    const near=[];for(const k of keys)for(const r of index.get(k)||[]){if(f.date&&parisDay(r.std)!==f.date)continue;const m=mm(parisClock(r.std));if(m==null)continue;let d=Math.abs(m-s);d=Math.min(d,1440-d);if(d<=15)near.push(r)}
    if(new Set(near.map(r=>r.std)).size===1)return near[0];
  }
  return null;
}

async function loadPages(fetchImpl,nowMs){
  const start=Math.floor(nowMs/1000)-BACK_H*3600,rows=[];let status=0,verdict="OK";
  for(let page=1;page<=PAGES;page++){
    const r=await fetchImpl(`https://www.flightradar24.com/data/airports/cdg/departures?date=${start}&page=${page}`,{headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":UA},redirect:"manual"});
    status=r.status;const text=await r.text();
    if(r.status!==200){verdict=r.status===403||r.status===429||r.status===503?"BLOCKED":"HTTP_ERROR";break}
    const json=extractDataPage(text);if(!json){verdict=/just a moment|cf-chl|verify you are human/i.test(text)?"BLOCKED":"NO_USABLE_DATA";break}
    const b=parseBoard(json,{all:true});rows.push(...b.rows);if(!b.meta.hasMoreNextData)break;
  }
  return {rows,httpStatus:status,verdict};
}

// Lecture d'une plage (rattrapage) : à partir de fromSec, jusqu'à maxPages pages de 100 vols. Ne touche ni au cache ni à la pause.
export async function fetchBoardRange({fromSec,maxPages=8,stopAfterSec=0,fetchImpl=fetch}){
  const rows=[],info=[];let pages=0,verdict="OK",status=0,shifts=0;
  for(let page=1;page<=maxPages;page++){
    const r=await fetchImpl(`https://www.flightradar24.com/data/airports/cdg/departures?date=${fromSec}&page=${page}`,{headers:{accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":UA},redirect:"manual"});
    status=r.status;const text=await r.text();
    if(r.status!==200){verdict=r.status===403||r.status===429||r.status===503?"BLOCKED":"HTTP_ERROR";break}
    const json=extractDataPage(text);if(!json){verdict=/just a moment|cf-chl|verify you are human/i.test(text)?"BLOCKED":"NO_USABLE_DATA";break}
    const b=parseBoard(json,{all:true});pages++;rows.push(...b.rows);info.push({page,rows:b.rows.length,hasMore:b.meta.hasMoreNextData,hoursRange:b.meta.hoursRange,firstStd:b.rows.length?Math.min(...b.rows.map(x=>x.std)):0,outsideAllowance:json?.props?.meta?.outsideAllowance??null,withinMaxAllowance:json?.props?.meta?.withinMaxAllowance??null});
    const last=b.rows.length?Math.max(...b.rows.map(x=>x.std)):0;
    // Première page vide parce que la date demandée est hors de la fenêtre gratuite de FR24 : on avance de 2 h (3 essais).
    if(page===1&&!b.rows.length&&json?.props?.meta?.outsideAllowance&&shifts<3){shifts++;fromSec+=7200;page=0;continue}
    if(!b.meta.hasMoreNextData||(stopAfterSec&&last>stopAfterSec))break;
  }
  return {rows,pages,verdict,httpStatus:status,info,fromSecUsed:fromSec};
}

export async function getBoard({fetchImpl=fetch,nowMs=Date.now()}={}){
  if(nowMs<pausedUntil)return {status:"COOLDOWN",httpStatus:lastHttp,index:null};
  if(cache&&nowMs-cache.at<TTL_MS)return {status:"OK",httpStatus:200,index:cache.index};
  if(!inflight)inflight=(async()=>{
    try{const r=await loadPages(fetchImpl,nowMs);lastHttp=r.httpStatus;
      if(r.verdict!=="OK"&&!r.rows.length){if(r.verdict==="BLOCKED"||r.httpStatus===409)pausedUntil=Date.now()+PAUSE_MS;return {status:r.verdict==="BLOCKED"?"BLOCKED":r.verdict,httpStatus:r.httpStatus,index:null}}
      cache={at:nowMs,index:indexRows(r.rows)};return {status:"OK",httpStatus:200,index:cache.index}}
    catch(e){lastHttp=0;pausedUntil=Date.now()+2*60000;return {status:"FETCH_ERROR",httpStatus:0,index:null}}
    finally{inflight=null}})();
  return inflight;
}

// Résultat pour un vol : { attempt, semantic, fr24Id }. Le vol doit avoir la même date et la même heure prévue (STD) que la ligne du tableau.
export async function boardLookup(f,opts){
  if(upper(f.origin||"CDG")!=="CDG")return null;
  const b=await getBoard(opts),at=new Date().toISOString();
  if(!b.index)return {attempt:{source:"FR24BOARD",status:b.status,httpStatus:b.httpStatus,checkedAt:at},semantic:{},fr24Id:""};
  const row=matchRow(b.index,f);
  if(!row)return {attempt:{source:"FR24BOARD",status:"NOT_TRACKED",httpStatus:200,checkedAt:at},semantic:{},fr24Id:""};
  const semantic={};
  // L'heure d'un vol parti sur le tableau FR24 est l'heure de décollage (roues), comme sur la page du vol : elle alimente TAKEOFF, jamais ATD (heure de porte, lue sur FlightStats / FlightAware).
  if(row.status==="departed"&&row.time)semantic.takeoff=parisClock(row.time);
  // ETD seulement si FR24 a une vraie estimation : sinon l'heure du tableau est la STD, qui écraserait l'ETD donné par une autre source (AT779 : 13:16 / 13:05 en boucle).
  else if(row.time&&row.time!==row.std&&row.status!=="canceled")semantic.etd=parisClock(row.time);
  if(row.gate)semantic.gate=upper(row.gate);if(row.reg)semantic.reg=upper(row.reg);if(row.type)semantic.aircraft=upper(row.type);
  const has=Object.keys(semantic).length>0||row.fr24Id;
  return {attempt:{source:"FR24BOARD",status:has?"OK":"NO_USABLE_DATA",httpStatus:200,checkedAt:at},semantic,fr24Id:row.fr24Id||""};
}
// Porte absente comme ADMIN la compte : vide ou valeur de remplissage (« — », « - », N/A…), en lisant les mêmes champs (gate, departureGate).
export const gateValue=x=>{const v=clean(x?.gate||x?.departureGate||x?.departure_gate);return /^(—|–|-+|n\/?a|tbd|\?+|null|none|unknown)$/i.test(v)?"":v};
// État conservé entre deux passages du cron (voir runtime-state.js) : pause et cache du tableau.
export function boardExport(){return {pausedUntil,lastHttp,cache:cache?{at:cache.at,rows:[...cache.index.values()].flat()}:null}}
export function boardImport(st){
  if(!st)return;
  if(Number(st.pausedUntil)>pausedUntil){pausedUntil=Number(st.pausedUntil);lastHttp=Number(st.lastHttp)||lastHttp}
  if(st.cache&&Number(st.cache.at)&&Array.isArray(st.cache.rows)&&(!cache||Number(st.cache.at)>cache.at))cache={at:Number(st.cache.at),index:indexRows(st.cache.rows)};
}
export const __reset=()=>{cache=null;pausedUntil=0;inflight=null};
