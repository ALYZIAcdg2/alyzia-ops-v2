const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null};
const manual=(x,field)=>upper(x?.[field+'Source']).includes('MANUAL')||Boolean(x?.manual?.[field]||x?.manualOverrides?.[field]||x?.manual_fields?.[field]);

function derived(x){
  const raw=upper([x.providerStatusRaw,x.flight_status,x.opsStatus,x.status].filter(Boolean).join(' '));
  if(/CANCEL|ANNUL/.test(raw))return {status:'ANNULÉ',source:'STATUS_SANITIZER'};
  if(clean(x.ata||x.actualArrival||x.actual_arrival||x.gateIn||x.gate_in))return {status:'ARRIVÉE',source:clean(x.ataSource||x.statusSource)||'STATUS_SANITIZER'};
  if(clean(x.landing||x.landingTime||x.landing_time||x.touchdown)||/\bLANDED\b|ATTERI|POSÉ|POSE A|POSÉ À/.test(raw))return {status:'ATTERI',source:clean(x.landingSource||x.statusSource)||'STATUS_SANITIZER'};
  if(clean(x.takeoff||x.takeoffTime||x.takeoff_time||x.airborne)||/EN VOL|IN AIR|AIRBORNE|IN FLIGHT|EN ROUTE|TOOK OFF|DÉCOLLÉ|DECOLLE/.test(raw))return {status:'EN VOL',source:clean(x.takeoffSource||x.statusSource)||'STATUS_SANITIZER'};
  if(clean(x.atd||x.actualDeparture||x.actual_departure||x.gateOut||x.gate_out)||/\bDEPARTED\b|\bPARTI\b|GATE OUT/.test(raw))return {status:'PARTI',source:clean(x.atdSource||x.statusSource)||'STATUS_SANITIZER'};
  if(/EMBARQUEMENT\s+CLOS|BOARDING\s+CLOSED|GATE\s+CLOSED/.test(raw))return {status:'EMBARQUEMENT CLOS',source:clean(x.statusSource)||'STATUS_SANITIZER'};
  if(/EMBARQUEMENT|BOARDING/.test(raw))return {status:'EMBARQUEMENT',source:clean(x.statusSource)||'STATUS_SANITIZER'};
  const std=hhmm(x.std),etd=hhmm(x.etd||x.edt);let d=std!=null&&etd!=null?etd-std:0;if(d<-720)d+=1440;if(d>720)d-=1440;
  return {status:/DELAY|RETARD/.test(raw)||d>=5?'RETARDÉ':'PRÉVU',source:'STATUS_SANITIZER'};
}

export async function sanitizeTodayStatuses(env){
  if(!env?.OPS_DB)return {ok:false,error:'NO_DB'};
  const date=new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();
  const at=new Date().toISOString();let updated=0;
  for(const row of results){
    let x={};try{x=JSON.parse(row.data_json||'{}')}catch{}
    if(manual(x,'status'))continue;
    const next=derived(x),before=clean(x.status),beforeSource=clean(x.statusSource);
    if(!next.status||(before===next.status&&beforeSource===next.source))continue;
    const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:next.source,field:'status',from:before,to:next.status});x.flightInfoLog=log.slice(0,240);
    x.status=next.status;x.statusSource=next.source;x.statusUpdatedAt=at;
    await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();updated++;
  }
  return {ok:true,date,updated};
}
