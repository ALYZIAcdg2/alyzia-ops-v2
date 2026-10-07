// Lecture seule : vols du jour dont l'heure de départ est passée depuis plus de 20 min et qui n'ont toujours pas d'ATD, avec ce que chaque source en dit.
import {loadFidsState} from "./fids-atd-sweep.js";
const clean=v=>String(v??"").trim();
const parisDate=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));
const parisMin=ms=>{const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));return Number(p.hour)*60+Number(p.minute)};
const mins=v=>{const m=/^(\d{1,2}):(\d{2})/.exec(clean(v));return m?Number(m[1])*60+Number(m[2]):null};

export function lastAttempt(x,source){const a=(x.publicLiveBackfill?.attempts||[]).filter(t=>t.source===source);const t=a[0]||a[a.length-1];return t?(t.status+(t.httpStatus?" "+t.httpStatus:"")):"jamais lu"}

export function missingAtd(rows,{nowMs=Date.now(),fids=null,minLateMin=20}={}){
  const now=parisMin(nowMs),out=[],notDeparted=[];
  for(const x of rows){
    const s=mins(x.std);if(s===null||clean(x.atd))continue;
    if(now-s<minLateMin||now-s>720)continue;
    // Parti ? décollage, atterrissage ou ATA connus, ou statut EN VOL / ARRIVÉ. Un vol retardé qui attend encore au sol n'est pas un ATD manquant.
    const departed=Boolean(clean(x.takeoff)||clean(x.landing)||clean(x.ata))||/^(EN VOL|ARRIV|ATTERR)/i.test(clean(x.status));
    if(!departed){notDeparted.push(clean(x.flight));continue}
    const key=(clean(x.flight)||"")+"|"+clean(x.std).slice(0,5);
    out.push({flight:clean(x.flight),std:clean(x.std).slice(0,5),etd:clean(x.etd),takeoff:clean(x.takeoff),landing:clean(x.landing),ata:clean(x.ata),status:clean(x.status),
      fids:fids?.flights?.[key]||(fids?"absent de l'état":"?"),flightstats:lastAttempt(x,"FLIGHTSTATS"),flightaware:lastAttempt(x,"FLIGHTAWARE"),flightStatsId:/^\d+$/.test(clean(x.flightStatsId))});
  }
  out.sort((a,b)=>a.std.localeCompare(b.std));out.notDeparted=notDeparted;return out;
}

export async function missingAtdReport(env,{nowMs=Date.now(),date=""}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const day=date||parisDate(nowMs);
  const {results=[]}=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(day).all();
  const rows=results.map(r=>{try{return JSON.parse(r.data_json||"{}")}catch{return {}}});
  const fids=await loadFidsState(env).catch(()=>null);
  const list=missingAtd(rows,{nowMs,fids});
  return {ok:true,mode:"MISSING_ATD_NO_WRITE",date:day,fidsReadAt:fids?.at||null,fidsStatus:fids?.status||null,count:list.length,flights:list,delayedNotDeparted:list.notDeparted||[]};
}
