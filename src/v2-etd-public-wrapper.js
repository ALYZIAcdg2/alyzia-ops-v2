import app from "./v2-admin-all-public-sources-wrapper.js";
import {runEtdPublicFlow,ETD_PUBLIC_SOURCE_ORDER,etdPublicStatus} from "./etd-public-flow.js";
import {normalizeFr24EtdLocalTime} from "./etd-fr24-localtime.js";
import {runGroundPublicFlow,groundPublicStatus} from "./ground-public-flow.js";

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}})}
async function runEtd(env){const flow=await runEtdPublicFlow(env);const local=await normalizeFr24EtdLocalTime(env);return {...flow,localTimeFix:local}}
function isQuarterHour(){return new Date().getUTCMinutes()%15===0}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==="/api/admin/etd-public-flow"){
      try{return json(await runEtd(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/etd-public-status"){
      try{return json(await etdPublicStatus(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/etd-public-sources")return json({ok:true,sources:ETD_PUBLIC_SOURCE_ORDER,cadenceMinutes:5});
    if(url.pathname==="/api/admin/ground-public-flow"){
      try{return json(await runGroundPublicFlow(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/ground-public-status"){
      try{return json(await groundPublicStatus(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/push-now"&&request.method==="POST"){
      try{
        const base=await app.fetch(request,env,ctx);
        let sta={};try{sta=await base.clone().json()}catch{}
        const [etd,ground]=await Promise.all([runEtd(env),runGroundPublicFlow(env)]);
        return json({...sta,ok:base.ok&&etd.ok&&ground.ok,etd,ground});
      }catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    return app.fetch(request,env,ctx);
  },
  scheduled(controller,env,ctx){
    if(typeof app.scheduled==="function")app.scheduled(controller,env,ctx);
    ctx.waitUntil(runEtd(env).catch(()=>{}));
    if(isQuarterHour())ctx.waitUntil(runGroundPublicFlow(env).catch(()=>{}));
  }
};
