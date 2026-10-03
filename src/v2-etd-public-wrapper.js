import app from "./v2-admin-all-public-sources-wrapper.js";
import {ETD_PUBLIC_SOURCE_ORDER} from "./etd-public-flow.js";
import {runEtdPublicFlowSafe,etdPublicStatusSafe} from "./etd-public-runner.js";
import {normalizeFr24EtdLocalTime} from "./etd-fr24-localtime.js";
import {runGroundPublicFlow,groundPublicStatus} from "./ground-public-flow.js";
import {runPublicLiveFlow,publicLiveStatus,LIVE_PUBLIC_SOURCE_ORDER} from "./ops-public-live-flow.js";
import {runParisAirportStatusFlow} from "./paris-airport-status-flow.js";
import {runStatusAirbornePublicFlow,STATUS_AIRBORNE_SOURCE_ORDER} from "./status-airborne-public-flow.js";
import {recoverValidatedLiveFacts} from "./ops-public-live-validated-recovery.js";
import {sanitizeTodayStatuses} from "./ops-status-sanitizer.js";
import {sanitizeTodayRegistrations} from "./ops-reg-sanitizer.js";

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}})}
async function runEtd(env){const cleanup=await normalizeFr24EtdLocalTime(env);const flow=await runEtdPublicFlowSafe(env);return {...flow,localTimeFix:cleanup}}
async function runLive(env,opts){
  const live=await runPublicLiveFlow(env,opts);
  const recovery=await recoverValidatedLiveFacts(env);
  const parisAeroport=await runParisAirportStatusFlow(env);
  const statusAirborne=await runStatusAirbornePublicFlow(env,{limit:opts?.limit||36,concurrency:opts?.concurrency||4});
  const [statusFix,regFix]=await Promise.all([sanitizeTodayStatuses(env),sanitizeTodayRegistrations(env)]);
  return {...live,recovery,parisAeroport,statusAirborne,statusFix,regFix};
}
async function runGround(env){const ground=await runGroundPublicFlow(env);const [statusFix,regFix]=await Promise.all([sanitizeTodayStatuses(env),sanitizeTodayRegistrations(env)]);return {...ground,statusFix,regFix}}
function isQuarterHour(controller){const t=Number(controller?.scheduledTime||Date.now());return new Date(t).getUTCMinutes()%15===0}
const STATUS_SOURCES=["Paris Aéroport",...STATUS_AIRBORNE_SOURCE_ORDER,"OpenSky","OAG"];
const PUSH_UI=String.raw`<script id="alyzia-push-all-public-js">(()=>{'use strict';
window.adminPushNow=async function(){
 const btn=document.getElementById('adminPushBtn'),msg=document.getElementById('adnPushMsg');
 if(btn){btn.disabled=true;btn.textContent='⚡ SOURCES…'}if(msg)msg.textContent='STA + ETD + STATUS CDG/FlightAware + ATD/ETA/ATA + GATE + TYPE/IMMAT en cours…';
 try{const r=await fetch('/api/admin/push-now',{method:'POST',cache:'no-store'}),j=await r.json();if(!j?.ok)throw new Error(j?.error||('HTTP '+r.status));
 const sta=j.filled??0,etd=j.etd?.updated??0,live=j.live?.updated??0,paris=j.live?.parisAeroport?.updated??0,statusLive=j.live?.statusAirborne?.updated??0,recovery=j.live?.recovery?.updated??0,statusFix=(j.live?.statusFix?.updated??0)+(j.ground?.statusFix?.updated??0),regFix=(j.live?.regFix?.updated??0)+(j.ground?.regFix?.updated??0),ground=j.ground?.updated??0;
 if(msg)msg.textContent='✓ PUSH · STA '+sta+' · ETD '+etd+' · PARIS '+paris+' · STATUS LIVE '+statusLive+' · LIVE '+live+' · STATUS '+statusFix+' · IMMAT '+regFix+' · RECOVERY '+recovery+' · GATE/TYPE/IMMAT '+ground;
 await window.renderAdminDashboard?.(true);
 }catch(e){if(msg)msg.textContent='ÉCHEC : '+(e?.message||e)}finally{if(btn){btn.disabled=false;btn.textContent='⚡ PUSH'}}
};
})();</script>`;
function patchHtml(html){const s=String(html||"");if(s.includes('id="alyzia-push-all-public-js"'))return s;const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+PUSH_UI+'\n'+s.slice(i):s+PUSH_UI}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==="/api/admin/etd-public-flow"){
      try{return json(await runEtd(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/etd-public-status"){
      try{return json(await etdPublicStatusSafe(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/etd-public-sources")return json({ok:true,sources:ETD_PUBLIC_SOURCE_ORDER,cadenceMinutes:5});
    if(url.pathname==="/api/admin/live-public-flow"){
      try{return json(await runLive(env,{limit:24,concurrency:3}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/live-public-status"){
      try{return json(await publicLiveStatus(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/live-public-sources")return json({ok:true,sources:{...LIVE_PUBLIC_SOURCE_ORDER,status:STATUS_SOURCES},fr24UsedForStatus:false,cadenceMinutes:5});
    if(url.pathname==="/api/admin/ground-public-flow"){
      try{return json(await runGround(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/ground-public-status"){
      try{return json(await groundPublicStatus(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/push-now"&&request.method==="POST"){
      try{
        const base=await app.fetch(request,env,ctx);
        let sta={};try{sta=await base.clone().json()}catch{}
        const [etd,live,ground]=await Promise.all([runEtd(env),runLive(env,{limit:36,concurrency:4}),runGround(env)]);
        const finalStatus=await sanitizeTodayStatuses(env);
        return json({...sta,ok:base.ok&&etd.ok&&live.ok&&ground.ok,etd,live:{...live,finalStatus},ground});
      }catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    const response=await app.fetch(request,env,ctx);
    const type=String(response.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html'))return response;
    const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store');
    return new Response(patchHtml(await response.text()),{status:response.status,statusText:response.statusText,headers});
  },
  scheduled(controller,env,ctx){
    if(typeof app.scheduled==="function")app.scheduled(controller,env,ctx);
    ctx.waitUntil(runEtd(env).catch(()=>{}));
    ctx.waitUntil(runLive(env,{limit:12,concurrency:3}).catch(()=>{}));
    if(isQuarterHour(controller))ctx.waitUntil(runGround(env).catch(()=>{}));
  }
};
