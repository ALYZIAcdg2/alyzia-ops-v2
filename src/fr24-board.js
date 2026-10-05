// Source "FR24 tableau CDG" : le tableau public des départs de CDG (100 vols par page) lu en lot, au lieu d'une lecture par vol.
// Donne : heure de départ réelle (vols « departed »), immatriculation, type d'avion et identifiant FR24 du vol.
// Cache 8 min partagé par tous les vols d'un passage ; en cas de refus (403/429/409/challenge) la source se met en pause 10 min.
import {extractDataPage,parseBoard} from "./fr24-board-parse.js";
import {flightLookupVariants} from "./public-flight-alias.js";

const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const TTL_MS=8*60000,PAUSE_MS=10*60000,BACK_H=3,PAGES=3;
const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
let cache=null,pausedUntil=0,inflight=null,lastHttp=0;

const parisClock=sec=>{if(!sec)return"";const p=new Intl.DateTimeFormat("fr-FR",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(sec*1000)),m=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${m.hour}:${m.minute}`};
export const parisDay=sec=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(sec*1000));

export function indexRows(rows){const m=new Map();for(const r of rows){const k=upper(r.flight);if(k&&!m.has(k))m.set(k,r)}return m}

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

export async function getBoard({fetchImpl=fetch,nowMs=Date.now()}={}){
  if(nowMs<pausedUntil)return {status:"COOLDOWN",httpStatus:lastHttp,index:null};
  if(cache&&nowMs-cache.at<TTL_MS)return {status:"OK",httpStatus:200,index:cache.index};
  if(!inflight)inflight=(async()=>{
    try{const r=await loadPages(fetchImpl,nowMs);lastHttp=r.httpStatus;
      if(r.verdict!=="OK"&&!r.rows.length){if(r.verdict==="BLOCKED"||r.httpStatus===409)pausedUntil=Date.now()+PAUSE_MS;return {status:r.verdict==="BLOCKED"?"BLOCKED":r.verdict,httpStatus:r.httpStatus,index:null}}
      cache={at:Date.now(),index:indexRows(r.rows)};return {status:"OK",httpStatus:200,index:cache.index}}
    catch(e){lastHttp=0;pausedUntil=Date.now()+2*60000;return {status:"FETCH_ERROR",httpStatus:0,index:null}}
    finally{inflight=null}})();
  return inflight;
}

// Résultat pour un vol : { attempt, semantic, fr24Id }. Le vol doit avoir la même date et la même heure prévue (STD) que la ligne du tableau.
export async function boardLookup(f,opts){
  if(upper(f.origin||"CDG")!=="CDG")return null;
  const b=await getBoard(opts),at=new Date().toISOString();
  if(!b.index)return {attempt:{source:"FR24BOARD",status:b.status,httpStatus:b.httpStatus,checkedAt:at},semantic:{},fr24Id:""};
  const keys=[upper(f.designator),...flightLookupVariants({airline:f.airline,number:f.number}).map(v=>upper(v.airline)+upper(v.number))];
  let row=null;for(const k of keys){const r=b.index.get(k);if(r){row=r;break}}
  if(!row||(f.date&&parisDay(row.std)!==f.date)||(f.std&&parisClock(row.std)!==f.std))return {attempt:{source:"FR24BOARD",status:"NOT_TRACKED",httpStatus:200,checkedAt:at},semantic:{},fr24Id:""};
  const semantic={};
  if(row.status==="departed"&&row.time)semantic.atd=parisClock(row.time);
  if(row.reg)semantic.reg=upper(row.reg);if(row.type)semantic.aircraft=upper(row.type);
  const has=Object.keys(semantic).length>0||row.fr24Id;
  return {attempt:{source:"FR24BOARD",status:has?"OK":"NO_USABLE_DATA",httpStatus:200,checkedAt:at},semantic,fr24Id:row.fr24Id||""};
}
export const __reset=()=>{cache=null;pausedUntil=0;inflight=null};
