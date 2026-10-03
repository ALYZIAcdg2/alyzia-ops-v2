const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();
const INVALID=/^(?:ON[ -]?TIME|SCHEDULED|DELAYED|DEPARTED|ARRIVED|LANDED|IN[ -]?AIR|AIRBORNE|EN[ -]?VOL|PREVU|PRÉVU|RETARDE|RETARDÉ|PARTI|CANCELLED|CANCELED|ANNULÉ|N\/A|NULL|UNKNOWN)$/i;
function bad(v){const s=clean(v);return !!s&&INVALID.test(s)}
const FIELDS=['reg','registration','aircraftRegistration','aircraft_registration','immat','immatriculation','tailNumber','tail_number','registrationNumber'];
export async function sanitizeTodayRegistrations(env){
  if(!env?.OPS_DB)return {ok:false,error:'NO_DB'};
  const date=new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();
  const at=new Date().toISOString();let updated=0,fieldsCleared=0;
  for(const row of results){let x={};try{x=JSON.parse(row.data_json||'{}')}catch{}
    const hits=FIELDS.filter(k=>bad(x[k]));if(!hits.length)continue;
    const before=hits.map(k=>`${k}=${clean(x[k])}`).join(' / ');
    for(const k of hits){delete x[k];fieldsCleared++}
    for(const k of ['regSource','registrationSource','aircraftRegistrationSource','immatSource','immatriculationSource','tailNumberSource']){
      if(upper(x[k]).startsWith('PUBLIC')||upper(x[k]).includes('FR24')||upper(x[k]).includes('FLIGHT'))delete x[k];
    }
    for(const k of ['regUpdatedAt','registrationUpdatedAt','aircraftRegistrationUpdatedAt','immatUpdatedAt','immatriculationUpdatedAt','tailNumberUpdatedAt'])delete x[k];
    const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:'REG_SANITIZER',field:'reg',from:before,to:''});x.flightInfoLog=log.slice(0,240);
    await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();updated++;
  }
  return {ok:true,date,updated,fieldsCleared};
}
