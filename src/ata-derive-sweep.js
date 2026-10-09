// ATA calculée à partir de l'atterrissage déjà connu, sans aucune lecture externe : un vol posé depuis 15 minutes ou plus sans ATA reçoit LDG + 10 min (ENT / E4 : tout de suite), comme la lecture du vol le fait.
// Sans ce passage, l'ATA n'arrivait qu'à la prochaine lecture du vol, qui pouvait tarder (TK1830 : posé à 11:32, toujours sans ATA 1 h 20 plus tard).
import {deriveAta} from "./ops-public-live-flow-optimized.js";
import {AIRPORT_TZ} from "./airport-tz.js";
const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
const parisDate=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));
const manual=(x,f)=>upper(x?.[f+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[f]||x?.manualOverrides?.[f]||x?.manual_fields?.[f]);
export async function sweepAtaFromLanding(env,{nowMs=Date.now(),dryRun=false}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const today=parisDate(nowMs),yesterday=parisDate(nowMs-86400000);
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,airline,data_json FROM flights WHERE flight_date IN (?,?) AND airline<>'SYS'`).bind(today,yesterday).all();
  const at=new Date(nowMs).toISOString(),done=[];
  for(const r of results){
    let x={};try{x=JSON.parse(r.data_json||"{}")}catch{continue}
    if(clean(x.ata)||!clean(x.landing)||manual(x,"ata"))continue;
    const dest=upper(x.destination||x.dest),d=deriveAta(x.landing,AIRPORT_TZ[dest]||"",x.airline||r.airline,new Date(nowMs));
    if(!d)continue;
    const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:`PUBLIC_LIVE:${d.source}`,field:"ata",from:"",to:d.value});
    x.flightInfoLog=log.slice(0,240);x.ata=d.value;x.ataSource=`PUBLIC_LIVE:${d.source}`;x.ataUpdatedAt=at;
    if(!dryRun)await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),r.identity).run();
    done.push({flight:x.flight||r.identity,landing:x.landing,ata:d.value});
  }
  return {ok:true,updated:done.length,items:done.slice(0,20)};
}
