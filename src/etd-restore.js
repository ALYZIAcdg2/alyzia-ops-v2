// Restaure l'ETD effacé par le tableau FR24 APRÈS la STD (règle corrigée dans #269) à partir du journal du vol : la dernière valeur non vide écrite avant l'effacement.
// Seuls les vols dont l'ETD est vide et dont la dernière écriture d'ETD est un effacement fait après la STD par le tableau FR24 : jamais une saisie manuelle, jamais un ETD déjà présent.
const clean=v=>String(v??"").trim(),upper=v=>clean(v).toUpperCase();
const hhmm=v=>{const m=clean(v).match(/(\d{1,2}):(\d{2})/);return m?String(m[1]).padStart(2,"0")+":"+m[2]:""};
const parisDate=()=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const parisMin=iso=>{const d=new Date(iso);if(!Number.isFinite(d.getTime()))return null;const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d).map(x=>[x.type,x.value]));return Number(p.hour)*60+Number(p.minute)};
const toMin=h=>{const m=/^(\d{2}):(\d{2})$/.exec(h||"");return m?+m[1]*60+ +m[2]:null};
export function lastEtdBeforeClear(x,std){
  if(hhmm(x?.etd||x?.edt))return null;
  if(/MANUAL/.test(upper(x?.etdSource)))return null;
  const log=(Array.isArray(x?.flightInfoLog)?x.flightInfoLog:[]).filter(l=>l&&(l.field==="etd"||l.field==="edt"));   // du plus récent au plus ancien
  const last=log[0];
  if(!last||clean(last.to)||!/FR24BOARD|ETD_TIME_NORMALIZER/.test(upper(last.source)))return null;                  // dernière écriture = effacement par le tableau FR24
  const s=toMin(hhmm(std)),c=parisMin(last.at);if(s===null||c===null||c<=s)return null;                           // effacé avant la STD : effacement légitime, on ne touche pas
  const prev=log.find(l=>hhmm(l.to)&&hhmm(l.to)!==hhmm(std));
  return prev?{etd:hhmm(prev.to),clearedAt:last.at}:null;
}
export function planEtdRestore(rows){
  return rows.filter(r=>upper(r.x?.origin||"CDG")==="CDG").map(r=>({r,c:lastEtdBeforeClear(r.x,r.std||r.x?.std)})).filter(z=>z.c).map(z=>({r:z.r,...z.c}));
}
export async function restoreEtds(env,{date="",dryRun=true}={}){
  if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
  const day=clean(date)||parisDate();
  const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_number,std,data_json FROM flights WHERE flight_date=? AND airline<>'SYS'`).bind(day).all();
  const rows=results.map(r=>{let x={};try{x=JSON.parse(r.data_json||"{}")}catch{}return {identity:r.identity,flight_number:r.flight_number,std:r.std,x}});
  const plan=planEtdRestore(rows),at=new Date().toISOString();
  if(!dryRun)for(const c of plan){
    const x=c.r.x;x.etd=c.etd;x.edt=c.etd;x.etdSource="PUBLIC_LIVE:ETD_RESTORED";x.etdUpdatedAt=at;x.etdTimeBasis="CDG_LOCAL";
    (x.flightInfoLog??=[]).unshift({at,source:"ETD_RESTORED",field:"etd",from:"",to:c.etd});x.flightInfoLog=x.flightInfoLog.slice(0,240);
    await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),c.r.identity).run();
  }
  return {ok:true,mode:dryRun?"ETD_RESTORE_DRY_RUN":"ETD_RESTORE_APPLIED",date:day,flights:rows.length,toRestore:plan.length,restored:dryRun?0:plan.length,items:plan.map(c=>({flight:c.r.flight_number,std:c.r.std||c.r.x.std,etd:c.etd,clearedAt:c.clearedAt,departed:Boolean(clean(c.r.x.atd)||clean(c.r.x.takeoff))}))};
}
