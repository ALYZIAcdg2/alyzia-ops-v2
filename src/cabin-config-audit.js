// Audit LECTURE SEULE : le type d'appareil de chaque vol face au catalogue des plans cabine (seatmap, table cabin_configs). N'écrit rien.
// GET /api/admin/cabin-config-audit?date=AAAA-MM-JJ : vol par vol, le plan existe-t-il pour (compagnie, type) ou un code équivalent, est-il choisi, est-il cohérent.
import {configCodes,toIata} from "./aircraft-change.js";
const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
const parisDate=ms=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));

export function auditFlight(x,catalog){
  const airline=upper(x.airline),type=upper(toIata(x.aircraftChange?.to||x.aircraftActual||x.aircraft)||x.aircraftChange?.to||x.aircraftActual||x.aircraft);
  const codes=type?configCodes(type):[],plans=catalog.filter(e=>upper(e.airline)===airline&&codes.includes(upper(e.aircraft)));
  const key=clean(x.sariaConfigKey),chosen=key?catalog.find(e=>e.config_key===key):null;
  let verdict="OK",why="";
  if(!type){verdict="TYPE MANQUANT"}
  else if(!plans.length){verdict="PLAN ABSENT";why=`aucun plan ${airline} ${codes.join("/")} dans le catalogue`}
  else if(!chosen&&!clean(x.sariaCabinConfig)){verdict="NON CHOISI";why=`${plans.length} plan(s) possible(s) : ${plans.slice(0,4).map(e=>e.aircraft+" "+e.configuration).join(", ")}`}
  else if(chosen&&!codes.includes(upper(chosen.aircraft))){verdict="INCOHÉRENT";why=`plan choisi ${chosen.airline} ${chosen.aircraft} ${chosen.configuration} pour un vol ${type}`}
  const cfgTotal=Object.values(x.config||{}).reduce((a,b)=>a+(Number(b)||0),0);
  if(verdict==="OK"&&chosen&&Number(chosen.total)>0&&cfgTotal>0&&cfgTotal!==Number(chosen.total)){verdict="CAPACITÉ DIFFÉRENTE";why=`fiche ${cfgTotal} sièges, plan ${chosen.total}`}
  if(verdict==="OK"&&chosen&&!cfgTotal){verdict="CONFIG VIDE";why="plan choisi mais aucune capacité enregistrée sur la fiche"}
  return {flight:upper(x.flight),airline,type,chosenPlan:chosen?`${chosen.aircraft} ${chosen.configuration}`:clean(x.sariaCabinConfig),auto:x.cabinConfigAuto===true,verdict,why,plansForType:plans.length};
}
export async function runCabinConfigAudit(env,{date="",nowMs=Date.now()}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const d=/^\d{4}-\d{2}-\d{2}$/.test(date)?date:parisDate(nowMs);
  let catalog=[];try{catalog=(await env.OPS_DB.prepare(`SELECT config_key,airline,aircraft,configuration,total FROM cabin_configs`).all()).results||[]}catch(e){return {ok:true,mode:"CABIN_CONFIG_AUDIT_NO_WRITE",date:d,error:"TABLE cabin_configs ABSENTE"}}
  const {results=[]}=await env.OPS_DB.prepare(`SELECT data_json,flight_number,airline FROM flights WHERE flight_date=? AND airline<>'SYS' ORDER BY std,flight_number`).bind(d).all();
  const rows=[];for(const r of results){let x={};try{x=JSON.parse(r.data_json||"{}")}catch{continue}if(!x.airline)x.airline=r.airline;if(!x.flight)x.flight=r.flight_number;rows.push(auditFlight(x,catalog))}
  const count=v=>rows.filter(r=>r.verdict===v).length,missing={};
  for(const r of rows.filter(r=>r.verdict==="PLAN ABSENT"))missing[r.airline+" "+r.type]=(missing[r.airline+" "+r.type]||0)+1;
  return {ok:true,mode:"CABIN_CONFIG_AUDIT_NO_WRITE",date:d,catalogPlans:catalog.length,flights:rows.length,ok_:count("OK"),planAbsent:count("PLAN ABSENT"),nonChoisi:count("NON CHOISI"),incoherent:count("INCOHÉRENT"),capaciteDifferente:count("CAPACITÉ DIFFÉRENTE"),configVide:count("CONFIG VIDE"),typeManquant:count("TYPE MANQUANT"),
    typesSansPlan:Object.entries(missing).sort((a,b)=>b[1]-a[1]).map(([k,n])=>({type:k,flights:n})),problems:rows.filter(r=>r.verdict!=="OK")};
}
