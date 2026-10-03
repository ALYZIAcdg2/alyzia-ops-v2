const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();
const manual=x=>upper(x?.statusSource||x?.status_source||'').includes('MANUAL')||Boolean(x?.manual?.status||x?.manualOverrides?.status||x?.manual_fields?.status);
const today=()=>new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export async function resetTodayAutomaticStatuses(env){
  if(!env?.OPS_DB)return {ok:false,error:'NO_DB'};
  const date=today();
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();
  let updated=0;
  for(const row of results){
    let x={};try{x=JSON.parse(row.data_json||'{}')}catch{}
    if(manual(x))continue;
    let changed=false;
    for(const k of ['status','statusSource','statusUpdatedAt','status_source','opsStatus','opsStatusSource','providerStatusRaw','providerStatusRawSource']){
      if(k in x&&clean(x[k])){delete x[k];changed=true}
    }
    if(x.publicLiveBackfill&&typeof x.publicLiveBackfill==='object'&&'status' in x.publicLiveBackfill){delete x.publicLiveBackfill.status;changed=true}
    if(!changed)continue;
    await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();
    updated++;
  }
  return {ok:true,date,updated,statusMode:'DISABLED'};
}
