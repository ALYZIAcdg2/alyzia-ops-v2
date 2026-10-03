import app from "./v2-admin-all-public-sources-wrapper.js";
import {ETD_PUBLIC_SOURCE_ORDER} from "./etd-public-flow.js";
import {runEtdPublicFlowSafe,etdPublicStatusSafe} from "./etd-public-runner.js";
import {normalizeFr24EtdLocalTime} from "./etd-fr24-localtime.js";
import {runGroundPublicFlow,groundPublicStatus} from "./ground-public-flow.js";
import {runPublicLiveFlow,publicLiveStatus,LIVE_PUBLIC_SOURCE_ORDER} from "./ops-public-live-flow.js";
import {recoverValidatedLiveFacts} from "./ops-public-live-validated-recovery.js";
import {sanitizeTodayRegistrations} from "./ops-reg-sanitizer.js";
import {resetTodayAutomaticStatuses} from "./ops-status-reset.js";

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}})}
async function runEtd(env){const cleanup=await normalizeFr24EtdLocalTime(env);const flow=await runEtdPublicFlowSafe(env);return {...flow,localTimeFix:cleanup}}
async function runLive(env,opts){
  const live=await runPublicLiveFlow(env,opts);
  const recovery=await recoverValidatedLiveFacts(env);
  const regFix=await sanitizeTodayRegistrations(env);
  const statusReset=await resetTodayAutomaticStatuses(env);
  return {...live,recovery,regFix,statusReset};
}
async function runGround(env){
  const ground=await runGroundPublicFlow(env);
  const regFix=await sanitizeTodayRegistrations(env);
  const statusReset=await resetTodayAutomaticStatuses(env);
  return {...ground,regFix,statusReset};
}
function isQuarterHour(controller){const t=Number(controller?.scheduledTime||Date.now());return new Date(t).getUTCMinutes()%15===0}

const STATUS_OFF=String.raw`<style id="alyzia-status-disabled-css">
.flight-home-row .v2-status,.flight-detail-status-wrap,.flight-head .v2-status{display:none!important}
</style>
<script id="alyzia-status-disabled-js">(()=>{'use strict';
function hideStatusColumns(){
 for(const table of document.querySelectorAll('table')){
  const headers=[...table.querySelectorAll('thead th')];
  const i=headers.findIndex(h=>String(h.textContent||'').trim().toUpperCase()==='STATUS');
  if(i<0)continue;
  headers[i].style.display='none';
  for(const row of table.querySelectorAll('tbody tr')){const cells=row.children;if(cells[i])cells[i].style.display='none'}
 }
 for(const el of document.querySelectorAll('.flight-home-row .v2-status,.flight-detail-status-wrap,.flight-head .v2-status'))el.style.display='none';
}
const start=()=>{hideStatusColumns();const root=document.getElementById('app');if(root)new MutationObserver(hideStatusColumns).observe(root,{childList:true,subtree:true})};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();</script>`;

const PUSH_UI=String.raw`<script id="alyzia-push-all-public-js">(()=>{'use strict';
window.adminPushNow=async function(){
 const btn=document.getElementById('adminPushBtn'),msg=document.getElementById('adnPushMsg');
 if(btn){btn.disabled=true;btn.textContent='⚡ SOURCES…'}if(msg)msg.textContent='STA + ETD + ATD/ETA/ATA + GATE + TYPE/IMMAT en cours…';
 try{const r=await fetch('/api/admin/push-now',{method:'POST',cache:'no-store'}),j=await r.json();if(!j?.ok)throw new Error(j?.error||('HTTP '+r.status));
 const sta=j.filled??0,etd=j.etd?.updated??0,live=j.live?.updated??0,recovery=j.live?.recovery?.updated??0,regFix=(j.live?.regFix?.updated??0)+(j.ground?.regFix?.updated??0),ground=j.ground?.updated??0;
 if(msg)msg.textContent='✓ PUSH · STA '+sta+' · ETD '+etd+' · LIVE '+live+' · IMMAT '+regFix+' · RECOVERY '+recovery+' · GATE/TYPE/IMMAT '+ground+' · STATUS DÉSACTIVÉ';
 await window.renderAdminDashboard?.(true);
 }catch(e){if(msg)msg.textContent='ÉCHEC : '+(e?.message||e)}finally{if(btn){btn.disabled=false;btn.textContent='⚡ PUSH'}}
};
})();</script>`;
function patchHtml(html){let s=String(html||"");const inserts=[];if(!s.includes('id="alyzia-status-disabled-css"'))inserts.push(STATUS_OFF);if(!s.includes('id="alyzia-push-all-public-js"'))inserts.push(PUSH_UI);if(!inserts.length)return s;const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+inserts.join('\n')+'\n'+s.slice(i):s+inserts.join('\n')}

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
    if(url.pathname==="/api/admin/live-public-sources")return json({ok:true,sources:{...LIVE_PUBLIC_SOURCE_ORDER,status:[]},statusMode:'DISABLED',cadenceMinutes:5});
    if(url.pathname==="/api/admin/status-reset"){
      try{return json(await resetTodayAutomaticStatuses(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
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
        const statusReset=await resetTodayAutomaticStatuses(env);
        return json({...sta,ok:base.ok&&etd.ok&&live.ok&&ground.ok,etd,live:{...live,statusReset},ground,statusMode:'DISABLED'});
      }catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    const response=await app.fetch(request,env,ctx);
    const type=String(response.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html'))return response;
    const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store');
    return new Response(patchHtml(await response.text()),{status:response.status,statusText:response.statusText,headers});
  },
  scheduled(controller,env,ctx){
    if(typeof app.scheduled==="function")app.scheduled(controller,env,ctx);
    ctx.waitUntil((async()=>{
      await runEtd(env).catch(()=>{});
      await runLive(env,{limit:12,concurrency:3}).catch(()=>{});
      if(isQuarterHour(controller))await runGround(env).catch(()=>{});
      await resetTodayAutomaticStatuses(env).catch(()=>{});
    })());
  }
};
