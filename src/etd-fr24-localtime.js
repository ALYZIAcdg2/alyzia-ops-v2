const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/^(\d{1,2}):(\d{2})$/);return m?`${String(Number(m[1])).padStart(2,"0")}:${m[2]}`:""};
function parisDate(){return new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function utcClockToParis(date,time){const t=hhmm(time);if(!t)return "";const d=new Date(`${date}T${t}:00Z`);if(!Number.isFinite(d.getTime()))return "";const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d).map(x=>[x.type,x.value]));return `${p.hour}:${p.minute}`}
export async function normalizeFr24EtdLocalTime(env){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const date=parisDate();
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();
  let changed=0;
  for(const row of results){
    let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
    const src=upper(x.etdSource);
    if(!src.includes("PUBLIC_ETD:FR24"))continue;
    const raw=hhmm(x.etd||x.edt);if(!raw)continue;
    if(x.etdTimeBasis==="CDG_LOCAL"&&x.etdRawUtc===raw)continue;
    const local=utcClockToParis(date,raw);if(!local)continue;
    x.etdRawUtc=raw;x.etd=local;x.edt=local;x.etdTimeBasis="CDG_LOCAL";x.etdUpdatedAt=new Date().toISOString();
    const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at:x.etdUpdatedAt,source:"FR24_UTC_TO_CDG_LOCAL",field:"etd",from:raw,to:local});x.flightInfoLog=log.slice(0,200);
    await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();changed++;
  }
  return {ok:true,date,changed};
}
