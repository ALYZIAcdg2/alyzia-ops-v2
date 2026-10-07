// Lecture seule. 1) état de FlightAware dans nos vols du jour (aucun appel) ; 2) sonde à la demande (2 requêtes espacées de 1,5 s) :
// page « live/flight » du vol puis page d'historique exacte trouvée dans celle-ci. Ne modifie rien et ne touche à aucune pause.
import {flightAwareHistoryUrl} from "./ops-public-live-flow-optimized.js";
import {flightAwareJsonSemantic} from "./flightaware-page-times.js";
const parisDate=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));
const hm=ms=>new Intl.DateTimeFormat("fr-FR",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit"}).format(new Date(ms));
const title=h=>((/<title[^>]*>([^<]*)/i.exec(h)||[])[1]||"").replace(/\s+/g," ").trim().slice(0,100);

export function summarizeFlightAware(rows,{nowMs=Date.now()}={}){
  const out={flights:0,withHistoryUrl:0,neverRead:0,lastStatus:{},readThisHour:0,limited429:0,atdFromFA:0,ataFromFA:0,etaFromFA:0,lastAtParis:null};let last=0;
  for(const x of rows){
    out.flights++;
    if(x.flightAwareHistoryUrl||x.flightawareHistoryUrl)out.withHistoryUrl++;
    if(/FLIGHTAWARE/i.test(x.atdSource||""))out.atdFromFA++;
    if(/FLIGHTAWARE/i.test(x.ataSource||""))out.ataFromFA++;
    if(/FLIGHTAWARE/i.test(x.etaSource||""))out.etaFromFA++;
    const att=(x.publicLiveBackfill?.attempts||[]).filter(a=>a.source==="FLIGHTAWARE"),a=att[0]||att[att.length-1];
    if(!a){out.neverRead++;continue}
    const k=a.status+(a.httpStatus?" "+a.httpStatus:"");out.lastStatus[k]=(out.lastStatus[k]||0)+1;
    if(Number(a.httpStatus)===429)out.limited429++;
    const t=Date.parse(a.checkedAt||"");if(Number.isFinite(t)){if(t>last)last=t;if(nowMs-t<=3600000)out.readThisHour++}
  }
  out.lastAtParis=last?hm(last):null;return out;
}

export async function flightAwareStatus(env,{nowMs=Date.now(),date=""}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const day=date||parisDate(nowMs);
  const {results=[]}=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(day).all();
  const rows=results.map(r=>{try{return JSON.parse(r.data_json||"{}")}catch{return {}}});
  return {ok:true,mode:"FLIGHTAWARE_STATUS_NO_WRITE",nowParis:hm(nowMs),date:day,note:"La pause FlightAware (45 min après un 429) est gardée en mémoire du Worker, pas lisible ici.",today:summarizeFlightAware(rows,{nowMs})};
}

const HEADERS={accept:"text/html,application/xhtml+xml","accept-language":"fr-FR,fr;q=0.9,en;q=0.8","user-agent":"Mozilla/5.0 (compatible; AlyziaOpsV2-FlightAwareLive/1.0)"};
export async function probeFlightAware({designator="",date="",std="",origin="CDG",destination=""},{fetchImpl=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
  designator=String(designator).toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(!designator||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{1,2}:\d{2}$/.test(std))return {ok:false,error:"designator (code OACI, ex. THY1830), date (AAAA-MM-JJ) et std (HH:MM) requis"};
  const out={};
  const grab=async(kind,url)=>{const t0=Date.now();try{const r=await fetchImpl(url,{redirect:"follow",headers:HEADERS}),body=await r.text();out[kind]={url,httpStatus:r.status,bytes:body.length,ms:Date.now()-t0,server:r.headers?.get?.("server")||null,retryAfter:r.headers?.get?.("retry-after")||null,title:title(body)};return body}catch(e){out[kind]={url,error:String(e?.message||e)};return ""}};
  const landing=await grab("landing",`https://www.flightaware.com/live/flight/${encodeURIComponent(designator)}`);
  const hist=out.landing.httpStatus===200?flightAwareHistoryUrl(landing,{date,std,origin,destination}):"";
  out.historyUrlFound=hist||null;
  if(hist){await sleep(1500);const body=await grab("history",hist);if(out.history.httpStatus===200){const s=flightAwareJsonSemantic(body,{origin,destination});out.history.times=Object.values(s).some(Boolean)?s:null}}
  return {ok:true,mode:"FLIGHTAWARE_PROBE_NO_WRITE",designator,date,std,results:out};
}
