const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();
const manual=x=>upper(x?.regSource).includes('MANUAL')||upper(x?.registrationSource).includes('MANUAL')||Boolean(x?.manual?.reg||x?.manualOverrides?.reg||x?.manual_fields?.reg);
const INVALID=/^(?:ON[ -]?TIME|SCHEDULED|DELAYED|DEPARTED|ARRIVED|LANDED|IN[ -]?AIR|AIRBORNE|EN[ -]?VOL|PREVU|PRÉVU|RETARDE|RETARDÉ|PARTI|N\/A|NULL|UNKNOWN)$/i;
function bad(v){const s=clean(v);return !!s&&INVALID.test(s)}
export async function sanitizeTodayRegistrations(env){
  if(!env?.OPS_DB)return {ok:false,error:'NO_DB'};
  const date=new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();
  const at=new Date().toISOString();let updated=0;
  for(const row of results){let x={};try{x=JSON.parse(row.data_json||'{}')}catch{}if(manual(x))continue;
    const vals=[x.reg,x.registration,x.aircraftRegistration];if(!vals.some(bad))continue;
    const before=vals.map(clean).filter(Boolean).join(' / ');
    if(bad(x.reg))delete x.reg;if(bad(x.registration))delete x.registration;if(bad(x.aircraftRegistration))delete x.aircraftRegistration;
    if(upper(x.regSource).startsWith('PUBLIC_LIVE'))delete x.regSource;
    delete x.regUpdatedAt;
    const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:'REG_SANITIZER',field:'reg',from:before,to:''});x.flightInfoLog=log.slice(0,240);
    await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();updated++;
  }
  return {ok:true,date,updated};
}
