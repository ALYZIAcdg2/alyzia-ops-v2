import {runSingleFlightAudit} from "./single-flight-public-audit.js";
import {noteActualAircraft} from "./aircraft-change.js";
import {AIRPORT_TZ} from "./airport-tz.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}});

function manualProtected(x,field){
  const src=upper(x?.[field+"Source"]);
  if(src.includes("MANUAL"))return true;
  if(x?.manual?.[field]||x?.manualOverrides?.[field]||x?.manual_fields?.[field])return true;
  const arr=Array.isArray(x?.manualChanges)?x.manualChanges:[];
  return arr.some(m=>upper(m?.field)===upper(field)&&m?.active!==false);
}
function pushLog(x,field,from,to,source,at){
  const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];
  log.unshift({at,source,field,from:clean(from),to:clean(to)});
  x.flightInfoLog=log.slice(0,240);
}
function localHH(iso,airport){
  const raw=clean(iso);if(!raw)return "";
  const d=new Date(raw);if(!Number.isFinite(d.getTime()))return "";
  const zone=AIRPORT_TZ[upper(airport)]||"Europe/Paris";
  try{
    const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:zone,hourCycle:"h23",hour:"2-digit",minute:"2-digit"}).formatToParts(d).map(x=>[x.type,x.value]));
    return `${p.hour}:${p.minute}`;
  }catch{return ""}
}
function addMinutes(v,delta){
  const m=clean(v).match(/^(\d{2}):(\d{2})$/);if(!m)return "";
  const total=(Number(m[1])*60+Number(m[2])+Number(delta)+1440)%1440;
  return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
}
function setField(x,field,value,source,now,{onlyIfMissing=false}={}){
  const next=clean(value);if(!next||manualProtected(x,field))return false;
  const before=clean(x[field]);if(onlyIfMissing&&before)return false;if(before===next)return false;
  pushLog(x,field,before,next,source,now);x[field]=next;x[field+"Source"]=source;x[field+"UpdatedAt"]=now;return true;
}
function setReg(x,value,source,now){
  const next=upper(value);if(!next||manualProtected(x,"reg"))return false;
  const before=clean(x.reg||x.registration||x.aircraftRegistration);if(before===next)return false;
  pushLog(x,"reg",before,next,source,now);x.reg=next;x.registration=next;x.aircraftRegistration=next;x.regSource=source;x.regUpdatedAt=now;return true;
}
function statusFrom(x,fr24Status){
  if(clean(x.ata))return "ARRIVÉE";
  if(clean(x.landing)||/LANDED/i.test(clean(fr24Status)))return "ATTERI";
  if(clean(x.takeoff)||/AIRBORNE/i.test(clean(fr24Status)))return "EN VOL";
  if(clean(x.atd))return "DECOLLE";
  return clean(x.status)||"PRÉVU";
}

export async function applyCtmSingleFlight(env,{flight,date,identity}={}){
  const audit=await runSingleFlightAudit(env,identity?{identity}:{flight,date});
  if(!audit?.ok)return audit;
  if(!upper(audit.flight).startsWith("CTM"))return {ok:false,error:"CTM_ONLY",flight:audit.flight};
  const fr24=(audit.sources||[]).find(s=>s.name==="FR24");
  const sem=fr24?.candidates?.semantic||{};
  if(fr24?.status!=="OK"||!fr24?.candidates?.occurrenceMatched)return {ok:false,error:"FR24_EXACT_NOT_USABLE",audit};

  const row=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE identity=? LIMIT 1`).bind(audit.identity).first();
  if(!row)return {ok:false,error:"FLIGHT_NOT_FOUND_AFTER_AUDIT"};
  let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
  const now=new Date().toISOString();
  const source=`FR24_PUBLIC_EXACT:${fr24.candidates.fr24OccurrenceId||audit.fr24OccurrenceId||""}`;
  const origin=upper(sem.origin||x.origin||"CDG"),destination=upper(sem.destination||x.destination||"");
  const applied={};
  const apply=(field,value,opts)=>{if(setField(x,field,value,source,now,opts)){applied[field]=value;return true}return false};

  if(!clean(x.origin)&&origin){x.origin=origin;applied.origin=origin}
  if(!clean(x.destination)&&destination){x.destination=destination;applied.destination=destination}
  const std=localHH(sem.std,origin),etd=localHH(sem.etd,origin),takeoff=localHH(sem.takeoff,origin);
  const sta=localHH(sem.sta,destination),eta=localHH(sem.eta,destination),landing=localHH(sem.landing,destination);
  apply("std",std,{onlyIfMissing:true});
  apply("sta",sta,{onlyIfMissing:true});
  apply("etd",etd);
  apply("takeoff",takeoff);
  apply("eta",eta);
  apply("landing",landing);
  // CTM-only fallback approved: takeoff stands in for a missing gate ATD.
  if(!manualProtected(x,"atd")&&clean(x.takeoff)&&(!clean(x.atd)||x.atdSource==="DERIVED:CTM_TAKEOFF")){
    const next=clean(x.takeoff),before=clean(x.atd);
    if(next!==before){
      pushLog(x,"atd",before,next,"DERIVED:CTM_TAKEOFF",now);
      x.atd=next;x.atdSource="DERIVED:CTM_TAKEOFF";x.atdUpdatedAt=now;
      x.atdDerived=true;x.atdDerivedFrom="takeoff";x.atdDerivationMinutes=0;
      applied.atd=next;
    }
  }
  if(sem.gateOrigin)apply("gate",upper(sem.gateOrigin));
  if(sem.terminalOrigin)apply("terminal",upper(sem.terminalOrigin));
  if(setReg(x,sem.reg,source,now))applied.reg=upper(sem.reg);

  if(sem.type&&!manualProtected(x,"aircraft")){
    const before=clean(x.aircraftActual||x.aircraftChange?.to||x.aircraft);
    if(noteActualAircraft(x,upper(sem.type),source,now)){
      applied.aircraftActual=clean(x.aircraftActual||x.aircraftChange?.to||sem.type);
      pushLog(x,"aircraftActual",before,applied.aircraftActual,source,now);
    }
  }

  if(!manualProtected(x,"ata")&&clean(x.landing)){
    const currentSource=upper(x.ataSource);
    if(!clean(x.ata)||currentSource==="DERIVED:CTM_LANDING_PLUS_10"){
      const next=addMinutes(x.landing,10),before=clean(x.ata);
      if(next&&next!==before){
        pushLog(x,"ata",before,next,"DERIVED:CTM_LANDING_PLUS_10",now);
        x.ata=next;x.ataSource="DERIVED:CTM_LANDING_PLUS_10";x.ataUpdatedAt=now;x.ataDerived=true;x.ataDerivedFrom="landing";x.ataDerivationMinutes=10;applied.ata=next;
      }
    }
  }

  if(!manualProtected(x,"status")){
    const next=statusFrom(x,sem.status);if(clean(x.status)!==next){pushLog(x,"status",x.status,next,source,now);x.status=next;x.statusSource=source;x.statusUpdatedAt=now;applied.status=next}
  }
  x.fr24OccurrenceId=fr24.candidates.fr24OccurrenceId||audit.fr24OccurrenceId||x.fr24OccurrenceId;
  x.ctmExactFr24AppliedAt=now;
  await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),audit.identity).run();
  return {ok:true,mode:"CTM_EXACT_FR24_SAFE_APPLY",identity:audit.identity,flight:audit.flight,date:audit.date,source,applied,auditStatus:audit.status};
}

export async function handleCtmSingleFlightApply(request,env){
  const url=new URL(request.url);if(url.pathname!=="/api/v2/audit-flight/apply")return null;
  if(request.method!=="POST")return json({ok:false,error:"METHOD"},405);
  const identity=clean(url.searchParams.get("identity")),flight=upper(url.searchParams.get("flight")),date=clean(url.searchParams.get("date"));
  if(!identity&&(!flight||!/^20\d{2}-\d{2}-\d{2}$/.test(date)))return json({ok:false,error:"IDENTITY_OR_FLIGHT_DATE_REQUIRED"},400);
  const result=await applyCtmSingleFlight(env,identity?{identity}:{flight,date});
  return json(result,result.ok?200:400);
}

