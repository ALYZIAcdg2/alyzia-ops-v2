// Pauses et caches gardés en mémoire du Worker : un nouveau passage du cron peut tourner dans une nouvelle instance et les perdre.
// Ils sont donc relus au début du passage et réécrits à la fin, dans la table ops_meta (une ligne), pour que la pause FlightStats
// et le cache du tableau FR24 (8 min) valent d'un passage à l'autre.
import {boardExport,boardImport} from "./fr24-board.js";
import {flightStatsExport,flightStatsImport} from "./ops-public-live-flow-optimized.js";

const KEY="runtime_state_v1";
let lastSaved="";

async function ensure(env){await env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS ops_meta(k TEXT PRIMARY KEY,v TEXT)`).run()}

export async function loadRuntimeState(env){
  if(!env?.OPS_DB)return false;
  try{
    await ensure(env);
    const row=await env.OPS_DB.prepare(`SELECT v FROM ops_meta WHERE k=?`).bind(KEY).first();
    if(!row?.v)return false;
    const st=JSON.parse(row.v);
    flightStatsImport(st.fs);boardImport(st.board);
    lastSaved=JSON.stringify({fs:st.fs,board:st.board});
    return true;
  }catch{return false}
}

export async function saveRuntimeState(env){
  if(!env?.OPS_DB)return false;
  try{
    const body={fs:flightStatsExport(),board:boardExport()},s=JSON.stringify(body);
    if(s===lastSaved)return false;
    await ensure(env);
    await env.OPS_DB.prepare(`INSERT INTO ops_meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(KEY,JSON.stringify({at:Date.now(),...body})).run();
    lastSaved=s;return true;
  }catch{return false}
}
export const __resetSaved=()=>{lastSaved=""};
