import app from "./refresh-scroll-stability-wrapper.js";
import seedRows from "../scripts/cabin_seed.json";
import seedOverrides from "../scripts/cabin_seed_overrides.json";
import deleteKeysFile from "../scripts/cabin_seed_delete_keys.json";

let bootstrapPromise=null;
let bootstrapped=false;

const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}});
const clean=v=>String(v??"").trim();

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

function internalRequest(baseUrl,path,{method="GET",body=null,env}={}){
  const headers=new Headers();
  if(body!=null)headers.set("content-type","application/json");
  if(clean(env?.ALYZIA_API_SECRET))headers.set("authorization",`Bearer ${env.ALYZIA_API_SECRET}`);
  return new Request(new URL(path,baseUrl),{method,headers,body:body==null?undefined:JSON.stringify(body)});
}

async function call(baseUrl,path,opts,env,ctx){
  return app.fetch(internalRequest(baseUrl,path,{...opts,env}),env,ctx);
}

async function parseJson(response){
  try{return await response.clone().json()}catch{return null}
}

async function currentConfigs(baseUrl,env,ctx){
  const response=await call(baseUrl,"/api/cabin/configs",{method:"GET"},env,ctx);
  const data=await parseJson(response);
  return {response,data,count:Array.isArray(data?.configs)?data.configs.length:0};
}

async function bootstrapCabins(baseUrl,env,ctx,{force=false}={}){
  if(bootstrapped&&!force)return {ok:true,alreadyBootstrapped:true};
  if(bootstrapPromise&&!force)return bootstrapPromise;
  const work=(async()=>{
    const before=await currentConfigs(baseUrl,env,ctx);
    if(!force&&before.response.ok&&before.count>0){bootstrapped=true;return {ok:true,alreadyPresent:true,count:before.count}}

    const {configs,deleteKeys,overrides}=effectiveSeed();
    const failures=[];

    for(const key of deleteKeys){
      const r=await call(baseUrl,`/api/cabin/layout?key=${encodeURIComponent(key)}`,{method:"DELETE"},env,ctx);
      if(!r.ok&&r.status!==404)failures.push({step:"delete",key,status:r.status,body:await r.text()});
    }

    const seedResponse=await call(baseUrl,"/api/cabin/seed",{method:"POST",body:{configs}},env,ctx);
    if(!seedResponse.ok){
      return {ok:false,error:"CABIN_SEED_FAILED",status:seedResponse.status,body:(await seedResponse.text()).slice(0,800),configsAttempted:configs.length,failures};
    }

    const recompute=await call(baseUrl,"/api/cabin/recompute-classes",{method:"POST",body:{}},env,ctx);
    if(!recompute.ok)failures.push({step:"recompute",status:recompute.status,body:(await recompute.text()).slice(0,500)});

    let operationalApplied=0;
    for(const row of (Array.isArray(overrides.configs)?overrides.configs:[])){
      if(!row?.operationalClasses||!Object.keys(row.operationalClasses).length)continue;
      const total=Number(row.operationalTotal||Object.values(row.operationalClasses).reduce((a,b)=>a+Number(b||0),0));
      const payload={configKey:row.configKey,airline:row.airline,aircraft:row.aircraft,configuration:row.configuration,total,classes:row.operationalClasses,quality:row.quality||"good",sourceLabel:row.sourceLabel||null};
      const r=await call(baseUrl,"/api/cabin/config",{method:"POST",body:payload},env,ctx);
      if(r.ok)operationalApplied++;else failures.push({step:"operational",key:row.configKey,status:r.status,body:(await r.text()).slice(0,500)});
    }

    const after=await currentConfigs(baseUrl,env,ctx);
    const ok=after.response.ok&&after.count>0;
    if(ok)bootstrapped=true;
    return {ok,mode:"V2_V1_CABIN_RESTORE",configsAttempted:configs.length,configsLoaded:after.count,operationalApplied,failures};
  })();
  bootstrapPromise=work.finally(()=>{bootstrapPromise=null});
  return bootstrapPromise;
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);

    if(url.pathname==="/api/v2/cabin/bootstrap"&&request.method==="POST"){
      return json(await bootstrapCabins(request.url,env,ctx,{force:url.searchParams.get("force")==="1"}));
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
