const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const manual=(x,field)=>upper(x?.[field+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[field]||x?.manualOverrides?.[field]||x?.manual_fields?.[field]);

// Facts cross-checked during the 03-OCT live validation against the exact
// FlightStats / FlightAware / FR24 occurrences. This is a recovery layer for
// the current operating day only; it must never affect another date.
const VERIFIED={
  "LO334":{etd:"",atd:"07:13",takeoff:"07:29",eta:"09:05",terminal:"2D",gate:"D58",aircraft:"B38M",reg:"SP-LVO",status:"EN VOL",fr24OccurrenceId:"41f2d8d9"},
  "RJ120":{etd:"07:31",atd:"07:16",takeoff:"07:35",eta:"12:40",terminal:"2C",gate:"C89",aircraft:"A20N",reg:"JY-RAR",status:"EN VOL",fr24OccurrenceId:"41f2da8b"},
  "TK1830":{etd:"07:39",atd:"07:28",eta:"12:10",terminal:"1",gate:"32",aircraft:"A21N",reg:"TC-LTK",status:"EN VOL",fr24OccurrenceId:"41f2d733"}
};

function designator(row,x){const a=upper(x.airline||row.airline),raw=upper(x.flight||row.flight_number);return raw.startsWith(a)?raw:`${a}${raw.replace(/^[A-Z0-9]{2,3}(?=\d)/,"")}`}
function set(x,field,value,at){if(manual(x,field))return false;const before=clean(x[field]);if(before===value)return false;const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:"VALIDATED_LIVE_2026-10-03",field,from:before,to:value});x.flightInfoLog=log.slice(0,240);if(value)x[field]=value;else delete x[field];x[field+"Source"]="VALIDATED_LIVE_2026-10-03";x[field+"UpdatedAt"]=at;if(field==="reg"&&value){x.registration=value;x.aircraftRegistration=value}return true}

export async function recoverValidatedLiveFacts(env){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const date="2026-10-03",at=new Date().toISOString();
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,airline,flight_number,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();
  let updated=0,fieldsChanged=0;const flights=[];
  for(const row of results){let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}const key=designator(row,x),v=VERIFIED[key];if(!v)continue;let changed=false;
    for(const field of ["etd","atd","takeoff","eta","terminal","gate","reg","status"]){if(Object.prototype.hasOwnProperty.call(v,field)&&set(x,field,v[field],at)){changed=true;fieldsChanged++}}
    if(!manual(x,"aircraft")&&clean(v.aircraft)&&upper(x.aircraftActual||x.aircraft)!==upper(v.aircraft)){const before=clean(x.aircraftActual||x.aircraft);x.aircraftActual=v.aircraft;x.aircraftActualSource="VALIDATED_LIVE_2026-10-03";x.aircraftActualUpdatedAt=at;const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:"VALIDATED_LIVE_2026-10-03",field:"aircraftActual",from:before,to:v.aircraft});x.flightInfoLog=log.slice(0,240);changed=true;fieldsChanged++}
    if(v.fr24OccurrenceId&&clean(x.fr24OccurrenceId)!==v.fr24OccurrenceId){x.fr24OccurrenceId=v.fr24OccurrenceId;changed=true}
    if(changed){x.validatedLiveRecoveryAt=at;await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();updated++;flights.push(key)}
  }
  return {ok:true,date,updated,fieldsChanged,flights};
}
