import app from "./v2-etd-public-wrapper.js";
import {runExactOccurrenceRecovery} from "./ops-exact-occurrence-recovery.js";
import {runStatusModelTest} from "./status-model-test.js";

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}})}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==="/api/admin/exact-occurrence-recovery"){
      try{const recovery=await runExactOccurrenceRecovery(env),statusModel=await runStatusModelTest(env);return json({ok:recovery.ok&&statusModel.ok,recovery,statusModel})}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/push-now"&&request.method==="POST"){
      const base=await app.fetch(request,env,ctx);let body={};try{body=await base.clone().json()}catch{}
      try{const recovery=await runExactOccurrenceRecovery(env),statusModel=await runStatusModelTest(env);return json({...body,ok:Boolean(body?.ok)&&recovery.ok&&statusModel.ok,exactOccurrenceRecovery:recovery,statusModelFinal:statusModel},base.status)}catch(error){return json({...body,ok:false,exactOccurrenceError:String(error?.message||error)},500)}
    }
    return app.fetch(request,env,ctx);
  },
  scheduled(controller,env,ctx){
    if(typeof app.scheduled==="function")app.scheduled(controller,env,ctx);
    ctx.waitUntil((async()=>{await runExactOccurrenceRecovery(env).catch(()=>{});await runStatusModelTest(env).catch(()=>{})})());
  }
};
