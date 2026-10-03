const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null};
const manual=(x,field)=>upper(x?.[field+'Source']).includes('MANUAL')||Boolean(x?.manual?.[field]||x?.manualOverrides?.[field]||x?.manual_fields?.[field]);
function parisMinutes(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return Number(p.hour)*60+Number(p.minute)}
function elapsedSince(v){const m=hhmm(v);if(m==null)return null;let d=parisMinutes()-m;if(d<-720)d+=1440;if(d>720)d-=1440;return d}
function airborneFallback(x){
  if(manual(x,'status'))return false;
  const atd=clean(x.atd||x.actualDeparture||x.actual_departure||x.gateOut||x.gate_out);
  const eta=clean(x.eta||x.estimatedArrival||x.estimated_arrival||x.sta);
  if(!atd||!eta)return false;
  const age=elapsedSince(atd);
  return age!=null&&age>=20;
}

function derived(x){
  const raw=upper(x.providerStatusRaw||x.flight_status||x.opsStatus);
  if(/CANCEL|ANNUL/.test(raw))return 'ANNULÉ';
  if(clean(x.ata||x.actualArrival||x.gateIn))return 'ARRIVÉE';
  if(clean(x.landing||x.touchdown))return 'ATTERI';
  if(clean(x.takeoff||x.takeoffTime||x.takeoff_time||x.airborne))return 'EN VOL';
  if(/EN VOL|IN AIR|AIRBORNE|IN FLIGHT|EN ROUTE|TOOK OFF/.test(raw))return 'EN VOL';
  if(upper(x.statusSource)==='VALIDATED_LIVE_2026-10-03'&&upper(x.status)==='EN VOL')return 'EN VOL';
  if(airborneFallback(x))return 'EN VOL';
  if(clean(x.atd||x.actualDeparture||x.gateOut))return 'PARTI';
  const std=hhmm(x.std),etd=hhmm(x.etd||x.edt);
  let d=std!=null&&etd!=null?etd-std:0;if(d<-720)d+=1440;if(d>720)d-=1440;
  return /DELAY|RETARD/.test(raw)||d>=5?'RETARDÉ':'PRÉVU';
}

export async function sanitizeTodayStatuses(env){
  if(!env?.OPS_DB)return {ok:false,error:'NO_DB'};
  const date=new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();
  const at=new Date().toISOString();let updated=0;
  for(const row of results){let x={};try{x=JSON.parse(row.data_json||'{}')}catch{}if(manual(x,'status'))continue;const next=derived(x),before=clean(x.status);if(!next||before===next)continue;
    const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:'STATUS_SANITIZER',field:'status',from:before,to:next});x.flightInfoLog=log.slice(0,240);
    x.status=next;x.statusSource='STATUS_SANITIZER';x.statusUpdatedAt=at;
    await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();updated++;
  }
  return {ok:true,date,updated};
}
