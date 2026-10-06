// Corrige, sur les vols d'hier et d'aujourd'hui déjà enregistrés, les ETA / atterrissages / ATA donnés en heure de l'origine au lieu de l'heure locale de destination
// (TS251 CDG-YUL : atterrissage 18:45 pour un décollage à 10:36). Même règle que la lecture des pages (guardArrivalClock). Jamais une saisie manuelle.
import {guardArrivalClock} from "./local-time-guard.js";
import {AIRPORT_TZ} from "./airport-tz.js";

const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
const manual=(x,f)=>upper(x?.[f+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[f]||x?.manualOverrides?.[f]||x?.manual_fields?.[f]);
const parisDay=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));

export function fixArrivalClocks(x,date){
  const out=[];
  const originZone=AIRPORT_TZ[upper(x.origin||x.dep||"CDG")]||"Europe/Paris",destZone=AIRPORT_TZ[upper(x.destination||x.dest)]||"";
  if(!destZone||!clean(x.sta)||!clean(x.std))return out;
  for(const f of ["eta","landing","ata"]){
    const v=clean(x[f]);if(!v||manual(x,f))continue;
    const g=guardArrivalClock(v,{std:x.std,sta:x.sta,date,originZone,destZone});
    if(g.status==="SHIFTED"&&g.value!==v)out.push({field:f,from:v,to:g.value});
  }
  return out;
}

export async function sanitizeArrivalClocks(env,{nowMs=Date.now()}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const today=parisDay(nowMs),yesterday=parisDay(nowMs-86400000);
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,data_json FROM flights WHERE flight_date IN (?,?) AND airline<>'SYS'`).bind(yesterday,today).all();
  const at=new Date(nowMs).toISOString();let updated=0,fixed=0;
  for(const r of results){
    let x={};try{x=JSON.parse(r.data_json||"{}")}catch{continue}
    const changes=fixArrivalClocks(x,r.flight_date);if(!changes.length)continue;
    const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];
    for(const c of changes){log.unshift({at,source:"ARRIVAL_TZ_FIX",field:c.field,from:c.from,to:c.to});x[c.field]=c.to;x[c.field+"Source"]=`${clean(x[c.field+"Source"])||"PUBLIC_LIVE"}+DEST_LOCAL`;x[c.field+"UpdatedAt"]=at;fixed++}
    x.flightInfoLog=log.slice(0,240);
    await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),r.identity).run();updated++;
  }
  return {ok:true,flights:results.length,updated,fixed};
}
