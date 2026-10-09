// Budget de temps d'un passage automatique (cron de 2 minutes).
// Le passage enchaîne une dizaine d'étapes et son temps est limité : le 9 octobre, une étape secondaire (lecture des pages FIDS par vol) a pris presque tout le temps et le passage a été coupé avant les lectures par vol (décollage, atterrissage, ATA).
// Règles : chaque étape a sa durée maximale (au-delà on passe à la suivante, le résultat est « timeout ») ; une étape facultative est sautée quand le passage a déjà duré plus que la limite douce ;
// les étapes essentielles (lectures par vol, tableau FR24, statuts) ne sont jamais sautées. Les durées de chaque étape sont gardées pour le diagnostic.
const TIMEOUT=Symbol("timeout");
export function timebox(work,ms){
  let timer;
  return Promise.race([
    Promise.resolve().then(()=>typeof work==="function"?work():work),
    new Promise(resolve=>{timer=setTimeout(()=>resolve(TIMEOUT),ms)})
  ]).then(v=>{clearTimeout(timer);return v},e=>{clearTimeout(timer);throw e});
}
export function createCronBudget({now=()=>Date.now(),softLimitMs=60000}={}){
  const start=now(),steps=[];
  return {
    elapsed:()=>now()-start,
    async step(name,fn,{ms=15000,optional=false,fallback=null}={}){
      const t0=now();
      if(optional&&t0-start>softLimitMs){steps.push({name,status:"skipped",startAt:t0-start});return fallback}
      try{
        const r=await timebox(fn,ms);
        if(r===TIMEOUT){steps.push({name,status:"timeout",ms:now()-t0,startAt:t0-start});return fallback}
        steps.push({name,status:"ok",ms:now()-t0,startAt:t0-start});return r;
      }catch(e){
        steps.push({name,status:"error",ms:now()-t0,startAt:t0-start,error:String(e?.message||e).slice(0,120)});return fallback;
      }
    },
    summary(){return {at:new Date(start).toISOString(),totalMs:now()-start,softLimitMs,steps:steps.slice()}}
  };
}
const KEY="cron_timing_v1";
export async function saveCronTiming(env,summary){try{
  await env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS ops_meta(k TEXT PRIMARY KEY,v TEXT)`).run();
  await env.OPS_DB.prepare(`INSERT INTO ops_meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(KEY,JSON.stringify(summary)).run();
}catch{}}
export async function loadCronTiming(env){try{const r=await env.OPS_DB.prepare(`SELECT v FROM ops_meta WHERE k=?`).bind(KEY).first();return r?.v?JSON.parse(r.v):null}catch{return null}}
