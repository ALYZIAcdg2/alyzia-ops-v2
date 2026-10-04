import {guardDepartureClock} from "./local-time-guard.js";
import {AIRPORT_TZ} from "./airport-tz.js";

const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const manual=(x,f)=>upper(x?.[f+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[f]||x?.manualOverrides?.[f]||x?.manual_fields?.[f]);
const parisDate=()=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const addDays=(date,n)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const DEPARTURE_FIELDS=["etd","atd","takeoff"];

// Read-only audit (repair=false) of what must always hold: every clock is local to its airport and a flight carries the date of its own row.
//  - "DATE": the date written in the flight (date / activeDate) is not the date of the row (e.g. a 1 Oct occurrence on a 4 Oct flight);
//  - "UTC": a departure clock (ETD / ATD / takeoff) more than 50 min before the planned STD, i.e. a UTC reading;
//  - "IMPLAUSIBLE": a departure clock that is not a plausible departure even once shifted.
// repair=true fixes "DATE" (date := row date) and "UTC" (clock shifted to local) on non-manual fields; "IMPLAUSIBLE" is only reported.
export async function auditFlightData(env,{from="",to="",repair=false}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const today=parisDate(),a=from||addDays(today,-1),b=to||addDays(today,1);
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,flight_number,std,data_json FROM flights WHERE flight_date BETWEEN ? AND ? AND airline<>'SYS' ORDER BY flight_date,std`).bind(a,b).all();
  const issues=[];let repaired=0;
  for(const row of results){
    let x={};try{x=JSON.parse(row.data_json||"{}")}catch{continue}
    const found=[];
    for(const key of ["date","activeDate"])if(clean(x[key])&&clean(x[key])!==row.flight_date)found.push({type:"DATE",field:key,value:x[key],expected:row.flight_date});
    const zone=AIRPORT_TZ[upper(x.dep||x.origin||"CDG")]||"Europe/Paris";
    for(const field of DEPARTURE_FIELDS){
      const v=clean(x[field]);if(!v)continue;
      const g=guardDepartureClock(v,x.std||row.std,row.flight_date,zone);
      if(g.status==="SHIFTED")found.push({type:"UTC",field,value:v,expected:g.value,source:clean(x[field+"Source"])});
      if(g.status==="REJECTED")found.push({type:"IMPLAUSIBLE",field,value:v,std:clean(x.std||row.std),source:clean(x[field+"Source"])});
    }
    if(!found.length)continue;
    for(const f of found)issues.push({identity:row.identity,flight:row.flight_number,flightDate:row.flight_date,...f});
    if(repair){
      let changed=false;const at=new Date().toISOString(),log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];
      for(const f of found){
        if(f.type==="DATE"){x[f.field]=row.flight_date;changed=true;log.unshift({at,source:"DATA_AUDIT",field:f.field,from:f.value,to:row.flight_date})}
        if(f.type==="UTC"&&!manual(x,f.field)){x[f.field]=f.expected;if(f.field==="etd")x.edt=f.expected;x[f.field+"TimeBasis"]="CDG_LOCAL";changed=true;log.unshift({at,source:"DATA_AUDIT",field:f.field,from:f.value,to:f.expected})}
      }
      if(changed){x.flightInfoLog=log.slice(0,240);await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();repaired++}
    }
  }
  const counts={};for(const i of issues)counts[i.type]=(counts[i.type]||0)+1;
  return {ok:true,from:a,to:b,checked:results.length,counts,repaired,repair,issues:issues.slice(0,300)};
}

// Read-only list of the cancelled flights (status ANNULÉ / CANCELLED) of a day range, with the source that set the status.
export async function listCancelled(env,{from="",to=""}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const today=parisDate(),a=from||today,b=to||a;
  const {results=[]}=await env.OPS_DB.prepare(`SELECT flight_date,flight_number,std,data_json FROM flights WHERE flight_date BETWEEN ? AND ? AND airline<>'SYS' ORDER BY flight_date,std`).bind(a,b).all();
  const flights=[];
  for(const row of results){let x={};try{x=JSON.parse(row.data_json||"{}")}catch{continue}
    if(/CANCEL|ANNUL/.test(upper(x.status)))flights.push({date:row.flight_date,flight:row.flight_number,std:row.std,dest:x.dest||x.destination||"",status:x.status,source:clean(x.statusSource)})}
  return {ok:true,from:a,to:b,scanned:results.length,cancelled:flights.length,flights};
}
