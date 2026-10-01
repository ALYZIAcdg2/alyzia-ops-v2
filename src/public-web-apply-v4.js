import {noteActualAircraft} from "./aircraft-change.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const APPLY_FIELDS=["etd","atd","takeoff","eta","landing","ata","terminal","gate","reg"];

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
function hh(v){const m=clean(v).match(/(\d{1,2}):(\d{2})/);return m?String(m[1]).padStart(2,"0")+":"+m[2]:""}
function minutes(v){const m=hh(v).match(/^(\d{2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null}
function delayMinutes(std,etd){const a=minutes(std),b=minutes(etd);if(a==null||b==null)return null;let d=b-a;if(d<-720)d+=1440;if(d>720)d-=1440;return d}
function recoverPlanningSta(x){
  if(clean(x.sta))return false;
  for(const v of [x.scheduledArrival,x.scheduled_arrival,x.schedule?.sta,x.planning?.sta,x.timings?.sta]){
    if(clean(v)){x.sta=clean(v);x.staSource="PLANNING_RECOVERED";return true}
  }
  const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];
  const hit=log.find(e=>upper(e?.field)==="STA"&&clean(e?.from));
  if(hit){x.sta=clean(hit.from);x.staSource="PLANNING_RECOVERED";return true}
  return false;
}
function setRegistrationAliases(x,value){
  x.reg=value;
  x.registration=value;
  x.aircraftRegistration=value;
}
function deriveStatus(x,confirmedStatus){
  if(/ANNUL|CANCEL/.test(upper(confirmedStatus))||/ANNUL|CANCEL/.test(upper(x.status)))return "ANNULÉ";
  if(clean(x.ata))return "ARRIVÉE";
  if(clean(x.landing))return "ATTERI";
  if(clean(x.takeoff))return "EN VOL";
  if(clean(x.atd))return "DECOLLE";
  const d=delayMinutes(x.std,x.etd);
  if(d!=null&&d>=5)return "RETARDÉ";
  return "PRÉVU";
}

export async function applyRunV4(env,runId){
  const run=await env.OPS_DB.prepare(`SELECT * FROM public_web_test_runs WHERE run_id=?`).bind(runId).first();
  if(!run||run.status!=="DONE")return {ok:false,error:"RUN_NOT_DONE"};
  const {results:ids=[]}=await env.OPS_DB.prepare(`SELECT DISTINCT flight_identity FROM public_web_consolidated_v2 WHERE run_id=?`).bind(runId).all();
  const now=new Date().toISOString();
  let flightsChanged=0,fieldsChanged=0,preserved=0,recoveredSta=0,aircraftActualChanged=0,manualSkipped=0;
  for(const it of ids){
    const row=await env.OPS_DB.prepare(`SELECT data_json FROM flights WHERE identity=?`).bind(it.flight_identity).first();
    if(!row)continue;
    let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
    const {results:vals=[]}=await env.OPS_DB.prepare(`SELECT field,chosen_value,state,source FROM public_web_consolidated_v2 WHERE run_id=? AND flight_identity=?`).bind(runId,it.flight_identity).all();
    const by=Object.fromEntries(vals.map(v=>[v.field,v]));
    let changed=false;

    if(!manualProtected(x,"sta")&&recoverPlanningSta(x)){recoveredSta++;changed=true}

    for(const field of APPLY_FIELDS){
      if(manualProtected(x,field)){manualSkipped++;continue}
      const r=by[field];
      if(!r||r.state!=="CONFIRMED"||!clean(r.chosen_value)){
        if(clean(x[field]))preserved++;
        continue;
      }
      const next=clean(r.chosen_value),before=clean(x[field]);
      if(field==="reg"){
        const old=clean(x.reg||x.registration||x.aircraftRegistration);
        if(old===next)continue;
        pushLog(x,"reg",old,next,`PUBLIC_WEB_V4:${r.source||"CONSENSUS"}`,now);
        setRegistrationAliases(x,next);
        x.regSource=`PUBLIC_WEB_V4:${r.source||"CONSENSUS"}`;x.regUpdatedAt=now;
        fieldsChanged++;changed=true;continue;
      }
      if(before===next)continue;
      pushLog(x,field,before,next,`PUBLIC_WEB_V4:${r.source||"CONSENSUS"}`,now);
      x[field]=next;x[field+"Source"]=`PUBLIC_WEB_V4:${r.source||"CONSENSUS"}`;x[field+"UpdatedAt"]=now;
      fieldsChanged++;changed=true;
    }

    const aircraft=by.aircraft;
    if(aircraft?.state==="CONFIRMED"&&clean(aircraft.chosen_value)&&!manualProtected(x,"aircraft")){
      const before=clean(x.aircraftActual||x.aircraftChange?.to||x.aircraft);
      const did=noteActualAircraft(x,clean(aircraft.chosen_value),`PUBLIC_WEB_V4:${aircraft.source||"CONSENSUS"}`,now);
      if(did){pushLog(x,"aircraftActual",before,clean(x.aircraftActual),`PUBLIC_WEB_V4:${aircraft.source||"CONSENSUS"}`,now);aircraftActualChanged++;fieldsChanged++;changed=true}
    }else if(clean(x.aircraftActual)||clean(x.aircraftChange?.to))preserved++;

    if(!manualProtected(x,"status")){
      const nextStatus=deriveStatus(x,by.status?.state==="CONFIRMED"?by.status.chosen_value:"");
      if(clean(x.status)!==nextStatus){pushLog(x,"status",x.status,nextStatus,"PUBLIC_WEB_V4:DERIVED",now);x.status=nextStatus;x.statusSource="PUBLIC_WEB_V4:DERIVED";x.statusUpdatedAt=now;fieldsChanged++;changed=true}
    }

    if(changed){
      x.publicWebV4AppliedAt=now;x.publicWebV4RunId=runId;
      await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),it.flight_identity).run();
      flightsChanged++;
    }
  }
  return {ok:true,runId,flightsChanged,fieldsChanged,preserved,recoveredSta,aircraftActualChanged,manualSkipped,mode:"SAFE_MERGE_V4"};
}
