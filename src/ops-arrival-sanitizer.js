// Corrige, sur les vols d'hier et d'aujourd'hui déjà enregistrés, les ETA / atterrissages / ATA donnés en heure de l'origine au lieu de l'heure locale de destination
// (TS251 CDG-YUL : atterrissage 18:45 pour un décollage à 10:36). Même règle que la lecture des pages (guardArrivalClock). Jamais une saisie manuelle.
import {guardArrivalClock,isFutureActual} from "./local-time-guard.js";
import {AIRPORT_TZ} from "./airport-tz.js";

const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
const manual=(x,f)=>upper(x?.[f+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[f]||x?.manualOverrides?.[f]||x?.manual_fields?.[f]);
const parisDay=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));

export function fixArrivalClocks(x,date,nowMs=Date.now()){
  const out=[];
  const originZone=AIRPORT_TZ[upper(x.origin||x.dep||"CDG")]||"Europe/Paris",destZone=AIRPORT_TZ[upper(x.destination||x.dest)]||"";
  if(!destZone)return out;
  const hasSched=clean(x.sta)&&clean(x.std);
  for(const f of ["eta","landing","ata"]){
    let v=clean(x[f]);if(!v||manual(x,f))continue;
    if(hasSched){const g=guardArrivalClock(v,{std:x.std,sta:x.sta,date,originZone,destZone});if(g.status==="SHIFTED"&&g.value!==v){out.push({field:f,from:v,to:g.value});v=g.value}}
    // Atterrissage / ATA dans le futur : c'est une estimation, pas un fait ; retiré (et gardé comme ETA s'il n'y en a pas).
    if(f!=="eta"&&isFutureActual(v,{date,std:x.std,takeoff:x.takeoff||x.atd,originZone,destZone,nowMs}))out.push({field:f,from:clean(x[f]),to:"",future:v});
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
    const changes=fixArrivalClocks(x,r.flight_date,nowMs);if(!changes.length)continue;
    const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];
    for(const c of changes){
      if(c.future!==undefined){   // fait dans le futur : retiré, gardé comme ETA ; le statut revient à « en vol » si le vol a décollé
        log.unshift({at,source:"ARRIVAL_FUTURE_FIX",field:c.field,from:c.from,to:""});
        if(!clean(x.eta)){x.eta=c.future;x.etaSource="ARRIVAL_FUTURE_FIX";x.etaUpdatedAt=at}
        delete x[c.field];delete x[c.field+"Source"];delete x[c.field+"UpdatedAt"];delete x[c.field+"Confirmed"];delete x[c.field+"Sources"];
        if(!clean(x.ata)&&!clean(x.landing)&&/ATTERR?I|ARRIV/i.test(clean(x.status))&&(clean(x.takeoff)||clean(x.atd))){x.status=clean(x.takeoff)?"EN VOL":"PARTI";x.statusSource="ARRIVAL_FUTURE_FIX";x.statusUpdatedAt=at}
        fixed++;continue;
      }
      log.unshift({at,source:"ARRIVAL_TZ_FIX",field:c.field,from:c.from,to:c.to});x[c.field]=c.to;x[c.field+"Source"]=`${clean(x[c.field+"Source"])||"PUBLIC_LIVE"}+DEST_LOCAL`;x[c.field+"UpdatedAt"]=at;fixed++;
    }
    x.flightInfoLog=log.slice(0,240);
    await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),r.identity).run();updated++;
  }
  return {ok:true,flights:results.length,updated,fixed};
}
