import app from "./v2-admin-all-public-sources-wrapper.js";
import {runEtdPublicFlow,ETD_PUBLIC_SOURCE_ORDER,etdPublicStatus} from "./etd-public-flow.js";

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}})}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==="/api/admin/etd-public-flow"){
      try{return json(await runEtdPublicFlow(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/etd-public-status"){
      try{return json(await etdPublicStatus(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/etd-public-sources")return json({ok:true,sources:ETD_PUBLIC_SOURCE_ORDER,cadenceMinutes:5});
    return app.fetch(request,env,ctx);
  },
  scheduled(controller,env,ctx){
    if(typeof app.scheduled==="function")app.scheduled(controller,env,ctx);
    ctx.waitUntil(runEtdPublicFlow(env).catch(()=>{}));
  }
};
