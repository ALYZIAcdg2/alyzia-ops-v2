// Synchronisation incrémentale du seed cabine vers D1 : écrit seulement les plans que ni D1 ni une synchronisation précédente ne connaissent
// (un plan supprimé à la main dans OUTILS n'est donc jamais recréé). Les plans existants ne sont jamais écrasés.
const SYNC_KEY="cabin_seed_synced_v1";
export async function syncSeedIntoD1(env,configs,writeRow,{force=false}={}){
  await env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS ops_meta(k TEXT PRIMARY KEY,v TEXT)`).run();
  const synced=await env.OPS_DB.prepare(`SELECT v FROM ops_meta WHERE k=?`).bind(SYNC_KEY).first();
  let known=null;try{known=synced?.v?new Set(JSON.parse(synced.v)):null}catch{}
  if(known&&!force&&configs.every(c=>known.has(c.configKey)))return {ok:true,upToDate:true,seedPlans:configs.length};
  const existing=new Set(((await env.OPS_DB.prepare(`SELECT config_key FROM cabin_configs`).all()).results||[]).map(r=>r.config_key));
  // Première synchronisation : tout ce qui est déjà dans D1 compte comme connu ; seuls les plans absents sont ajoutés.
  const written=[],failures=[];
  for(const row of configs){
    if(existing.has(row.configKey)||(known&&known.has(row.configKey)))continue;
    try{const n=await writeRow(env,row);if(n.configs)written.push(row.configKey)}catch(e){failures.push({key:row.configKey,error:String(e?.message||e)})}
  }
  if(!failures.length)await env.OPS_DB.prepare(`INSERT INTO ops_meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(SYNC_KEY,JSON.stringify(configs.map(c=>c.configKey))).run();
  return {ok:!failures.length,seedPlans:configs.length,written:written.length,writtenKeys:written,failures};
}
