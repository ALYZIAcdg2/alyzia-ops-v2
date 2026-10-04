const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/^(\d{1,2}):(\d{2})$/);return m?`${String(Number(m[1])).padStart(2,"0")}:${m[2]}`:""};
const mins=v=>{const t=hhmm(v);if(!t)return null;const [h,m]=t.split(":").map(Number);return h*60+m};
const diff=(a,b)=>{const x=mins(a),y=mins(b);if(x==null||y==null)return 999;const d=Math.abs(x-y);return Math.min(d,1440-d)};
function parisDate(){return new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function utcClockToParis(date,time){const t=hhmm(time);if(!t)return "";const d=new Date(`${date}T${t}:00Z`);if(!Number.isFinite(d.getTime()))return "";const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d).map(x=>[x.type,x.value]));return `${p.hour}:${p.minute}`}
export async function normalizeFr24EtdLocalTime(env){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const date=parisDate();
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_date,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(date).all();
  let changed=0,cleared=0;
  for(const row of results){
    let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
    const src=upper(x.etdSource);
    if(!src.includes("FR24"))continue;
    // Already read as a local clock (written by the public ETD flow, which converts FR24 text from UTC): nothing to guess.
    if(clean(x.etdTimeBasis)==="CDG_LOCAL"&&!x.etdRawUtc)continue;
    const raw=hhmm(x.etd||x.edt),std=hhmm(x.std||row.std);if(!raw||!std)continue;
    const converted=utcClockToParis(row.flight_date||date,raw);if(!converted)continue;
    const rawDiff=diff(raw,std),convertedDiff=diff(converted,std);
    const chosen=convertedDiff<rawDiff?converted:raw;
    const at=new Date().toISOString();
    if(chosen===std){
      delete x.etd;delete x.edt;delete x.etdSource;delete x.etdUpdatedAt;
      x.etdTimeBasis="CDG_LOCAL";x.etdRawUtc=convertedDiff<rawDiff?raw:(x.etdRawUtc||null);
      x.etdBackfill={...(x.etdBackfill||{}),checkedAt:at,status:"ETD_EQUALS_STD"};
      const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];log.unshift({at,source:"PUBLIC_ETD_TIME_NORMALIZER",field:"etd",from:raw,to:""});x.flightInfoLog=log.slice(0,200);
      await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();changed++;cleared++;continue;
    }
    if(chosen===raw&&x.etdTimeBasis==="CDG_LOCAL")continue;
    x.etdRawUtc=convertedDiff<rawDiff?raw:(x.etdRawUtc||null);x.etd=chosen;x.edt=chosen;x.etdTimeBasis="CDG_LOCAL";x.etdUpdatedAt=at;
    const log=Array.isArray(x.flightInfoLog)?x.flightInfoLog:[];if(chosen!==raw)log.unshift({at,source:"PUBLIC_ETD_UTC_TO_CDG_LOCAL",field:"etd",from:raw,to:chosen});x.flightInfoLog=log.slice(0,200);
    await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();changed++;
  }
  return {ok:true,date,changed,cleared};
}
