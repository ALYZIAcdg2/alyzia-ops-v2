import app from "./refresh-scroll-stability-wrapper.js";
import seedRows from "../scripts/cabin_seed.json";
import seedOverrides from "../scripts/cabin_seed_overrides.json";
import deleteKeysFile from "../scripts/cabin_seed_delete_keys.json";

let bootstrapPromise=null;
let bootstrapped=false;

const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}});

function effectiveSeed(){
  const overrides=seedOverrides&&typeof seedOverrides==="object"?seedOverrides:{};
  const deleteKeys=new Set([...(Array.isArray(deleteKeysFile)?deleteKeysFile:[]),...(Array.isArray(overrides.deleteKeys)?overrides.deleteKeys:[])].filter(Boolean));
  const byKey=new Map();
  for(const row of (Array.isArray(seedRows)?seedRows:[])){
    if(!row?.configKey||deleteKeys.has(row.configKey))continue;
    byKey.set(row.configKey,row);
  }
  for(const row of (Array.isArray(overrides.configs)?overrides.configs:[])){
    if(!row?.configKey||deleteKeys.has(row.configKey))continue;
    byKey.set(row.configKey,row);
  }
  return {configs:[...byKey.values()],deleteKeys:[...deleteKeys],overrides};
}

function internalRequest(baseUrl,path,{method="GET",body=null}={}){
  const headers=new Headers();
  if(body!=null)headers.set("content-type","application/json");
  return new Request(new URL(path,baseUrl),{method,headers,body:body==null?undefined:JSON.stringify(body)});
}

async function call(baseUrl,path,opts,env,ctx){
  return app.fetch(internalRequest(baseUrl,path,opts),env,ctx);
}

async function parseJson(response){
  try{return await response.clone().json()}catch{return null}
}

async function currentConfigs(baseUrl,env,ctx){
  const response=await call(baseUrl,"/api/cabin/configs",{method:"GET"},env,ctx);
  const data=await parseJson(response);
  return {response,data,count:Array.isArray(data?.configs)?data.configs.length:0};
}

function cabinZonesToClassCounts(zones){
  const counts={};
  for(const z of (zones||[])){
    const cls=String(z?.class||"").trim().toUpperCase();
    if(!cls)continue;
    const excMap={};
    String(z?.exceptions||"").split(/\n+/).map(s=>s.trim()).filter(Boolean).forEach(line=>{
      const m=line.match(/^(\d+)\s*=\s*(.+)$/);
      if(m)excMap[Number(m[1])]=m[2].trim();
    });
    const start=Number(z?.row_start),end=Number(z?.row_end);
    if(!Number.isFinite(start)||!Number.isFinite(end))continue;
    for(let r=start;r<=end;r++){
      const pat=Object.prototype.hasOwnProperty.call(excMap,r)?excMap[r]:String(z?.pattern||"");
      if(String(pat).trim().toUpperCase()==="SKIP")continue;
      const seats=String(pat||"").replace(/[^A-Z]/gi,"").length;
      counts[cls]=(counts[cls]||0)+seats;
    }
  }
  return counts;
}

async function ensureCabinTables(env){
  await env.OPS_DB.batch([
    env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS cabin_configs (
      config_key TEXT PRIMARY KEY,
      airline TEXT NOT NULL,
      aircraft TEXT NOT NULL,
      configuration TEXT,
      total INTEGER,
      classes_json TEXT NOT NULL DEFAULT '{}',
      quality TEXT,
      source_label TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS cabin_zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_key TEXT NOT NULL,
      class TEXT NOT NULL,
      row_start INTEGER NOT NULL,
      row_end INTEGER NOT NULL,
      pattern TEXT NOT NULL,
      placement_mode TEXT NOT NULL DEFAULT 'ALIGNE',
      exceptions TEXT DEFAULT '',
      sort_order INTEGER,
      deck TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS cabin_equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_key TEXT NOT NULL,
      type TEXT NOT NULL,
      row_reference INTEGER,
      side TEXT,
      label TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    env.OPS_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_cabin_configs_ac ON cabin_configs(airline,aircraft)`),
    env.OPS_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_cabin_zones_key ON cabin_zones(config_key)`),
    env.OPS_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_cabin_equipment_key ON cabin_equipment(config_key)`)
  ]);
  // Compat avec une D1 V2 créée par la migration initiale.
  await env.OPS_DB.prepare(`ALTER TABLE cabin_configs ADD COLUMN source_label TEXT`).run().catch(()=>{});
  await env.OPS_DB.prepare(`ALTER TABLE cabin_zones ADD COLUMN sort_order INTEGER`).run().catch(()=>{});
  await env.OPS_DB.prepare(`ALTER TABLE cabin_zones ADD COLUMN deck TEXT`).run().catch(()=>{});
}

async function deleteCabinKey(env,key){
  await env.OPS_DB.batch([
    env.OPS_DB.prepare(`DELETE FROM cabin_zones WHERE config_key=?`).bind(key),
    env.OPS_DB.prepare(`DELETE FROM cabin_equipment WHERE config_key=?`).bind(key),
    env.OPS_DB.prepare(`DELETE FROM cabin_configs WHERE config_key=?`).bind(key)
  ]);
}

async function writeCabinRow(env,row){
  const airline=String(row?.airline||"").trim().toUpperCase();
  const aircraft=String(row?.aircraft||"").trim().toUpperCase();
  const configuration=String(row?.configuration||"").trim().toUpperCase();
  const configKey=String(row?.configKey||`${airline}|${aircraft}|${configuration}`).trim();
  const zones=Array.isArray(row?.zones)?row.zones:[];
  if(!airline||!aircraft||!configuration||!configKey||!zones.length)return {configs:0,zones:0,equipment:0};

  const classCounts=row?.operationalClasses&&Object.keys(row.operationalClasses).length
    ? Object.fromEntries(Object.entries(row.operationalClasses).map(([k,v])=>[String(k).toUpperCase(),Number(v)||0]))
    : cabinZonesToClassCounts(zones);
  const total=Number(row?.operationalTotal||Object.values(classCounts).reduce((a,b)=>a+Number(b||0),0));

  await env.OPS_DB.prepare(`
    INSERT INTO cabin_configs (config_key,airline,aircraft,configuration,total,classes_json,quality,source_label,updated_at)
    VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(config_key) DO UPDATE SET
      airline=excluded.airline,
      aircraft=excluded.aircraft,
      configuration=excluded.configuration,
      total=excluded.total,
      classes_json=excluded.classes_json,
      quality=excluded.quality,
      source_label=excluded.source_label,
      updated_at=CURRENT_TIMESTAMP
  `).bind(configKey,airline,aircraft,configuration,total,JSON.stringify(classCounts),String(row?.quality||"summary"),row?.sourceLabel?String(row.sourceLabel):null).run();

  await env.OPS_DB.prepare(`DELETE FROM cabin_zones WHERE config_key=?`).bind(configKey).run();
  let zonesWritten=0;
  let sortOrder=10;
  for(const z of zones){
    const cls=String(z?.class||"").trim().toUpperCase();
    const rowStart=Number(z?.row_start),rowEnd=Number(z?.row_end);
    const pattern=String(z?.pattern||"").trim().toUpperCase();
    if(!cls||!Number.isFinite(rowStart)||!Number.isFinite(rowEnd)||!pattern)continue;
    await env.OPS_DB.prepare(`
      INSERT INTO cabin_zones (config_key,class,row_start,row_end,pattern,placement_mode,exceptions,sort_order,deck,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    `).bind(configKey,cls,rowStart,rowEnd,pattern,String(z?.placement_mode||z?.placementMode||"ALIGNE"),String(z?.exceptions||""),sortOrder,String(z?.deck||"").trim().toUpperCase()||null).run();
    sortOrder+=10;
    zonesWritten++;
  }

  await env.OPS_DB.prepare(`DELETE FROM cabin_equipment WHERE config_key=?`).bind(configKey).run();
  let equipmentWritten=0;
  for(const eq of (Array.isArray(row?.equipment)?row.equipment:[])){
    const type=String(eq?.type||"").trim().toUpperCase();
    const rowReference=Number(eq?.row_reference??eq?.rowReference);
    if(!type||!Number.isFinite(rowReference))continue;
    await env.OPS_DB.prepare(`
      INSERT INTO cabin_equipment (config_key,type,row_reference,side,label,created_at)
      VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)
    `).bind(configKey,type,rowReference,eq?.side?String(eq.side):null,eq?.label?String(eq.label):null).run();
    equipmentWritten++;
  }

  return {configs:1,zones:zonesWritten,equipment:equipmentWritten};
}

async function bootstrapCabins(baseUrl,env,ctx,{force=false}={}){
  if(bootstrapped&&!force)return {ok:true,alreadyBootstrapped:true};
  if(bootstrapPromise&&!force)return bootstrapPromise;
  const work=(async()=>{
    await ensureCabinTables(env);
    const before=await currentConfigs(baseUrl,env,ctx);
    if(!force&&before.response.ok&&before.count>0){bootstrapped=true;return {ok:true,alreadyPresent:true,count:before.count}}

    const {configs,deleteKeys}=effectiveSeed();
    const failures=[];
    let configsWritten=0,zonesWritten=0,equipmentWritten=0;

    for(const key of deleteKeys){
      try{await deleteCabinKey(env,key)}catch(e){failures.push({step:"delete",key,error:String(e?.message||e)})}
    }

    for(const row of configs){
      try{
        const n=await writeCabinRow(env,row);
        configsWritten+=n.configs;zonesWritten+=n.zones;equipmentWritten+=n.equipment;
      }catch(e){
        failures.push({step:"write",key:row?.configKey||null,error:String(e?.message||e)});
      }
    }

    const after=await currentConfigs(baseUrl,env,ctx);
    const ok=after.response.ok&&after.count>0;
    if(ok)bootstrapped=true;
    return {
      ok,
      mode:"V2_V1_CABIN_RESTORE_DIRECT_D1",
      configsAttempted:configs.length,
      configsWritten,
      zonesWritten,
      equipmentWritten,
      configsLoaded:after.count,
      failures
    };
  })();
  bootstrapPromise=work.finally(()=>{bootstrapPromise=null});
  return bootstrapPromise;
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);

    if(url.pathname==="/api/v2/cabin/bootstrap"&&request.method==="POST"){
      try{return json(await bootstrapCabins(request.url,env,ctx,{force:url.searchParams.get("force")==="1"}))}
      catch(e){return json({ok:false,error:"V2_CABIN_BOOTSTRAP_EXCEPTION",detail:String(e?.message||e)},500)}
    }

    if(url.pathname==="/api/cabin/configs"&&request.method==="GET"){
      const first=await app.fetch(request,env,ctx);
      const data=await parseJson(first);
      const count=Array.isArray(data?.configs)?data.configs.length:0;
      if(first.ok&&count>0){bootstrapped=true;return first}
      const restored=await bootstrapCabins(request.url,env,ctx);
      if(!restored.ok)return json({ok:false,error:"V2_CABIN_BOOTSTRAP_FAILED",bootstrap:restored},500);
      return app.fetch(request,env,ctx);
    }

    return app.fetch(request,env,ctx);
  },
  scheduled(controller,env,ctx){
    if(typeof app.scheduled==="function")return app.scheduled(controller,env,ctx);
  }
};
