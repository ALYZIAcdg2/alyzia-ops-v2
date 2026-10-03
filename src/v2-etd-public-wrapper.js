import app from "./v2-admin-all-public-sources-wrapper.js";
import {ETD_PUBLIC_SOURCE_ORDER} from "./etd-public-flow.js";
import {runEtdPublicFlowSafe,etdPublicStatusSafe} from "./etd-public-runner.js";
import {normalizeFr24EtdLocalTime} from "./etd-fr24-localtime.js";
import {runGroundPublicFlow,groundPublicStatus} from "./ground-public-flow.js";
import {runPublicLiveFlow,publicLiveStatus,LIVE_PUBLIC_SOURCE_ORDER} from "./ops-public-live-flow.js";
import {recoverValidatedLiveFacts} from "./ops-public-live-validated-recovery.js";
import {sanitizeTodayRegistrations} from "./ops-reg-sanitizer.js";
import {runParisAirportStatusFlow} from "./paris-airport-status-flow.js";
import {runStatusModelTest,STATUS_MODEL_TEST_RULES} from "./status-model-test.js";

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}})}
async function runEtd(env){const cleanup=await normalizeFr24EtdLocalTime(env);const flow=await runEtdPublicFlowSafe(env);return {...flow,localTimeFix:cleanup}}
async function runLive(env,opts){
  const live=await runPublicLiveFlow(env,opts);
  const recovery=await recoverValidatedLiveFacts(env);
  const parisAeroport=await runParisAirportStatusFlow(env);
  const regFix=await sanitizeTodayRegistrations(env);
  const statusModel=await runStatusModelTest(env);
  return {...live,recovery,parisAeroport,regFix,statusModel};
}
async function runGround(env){const ground=await runGroundPublicFlow(env);const regFix=await sanitizeTodayRegistrations(env);return {...ground,regFix}}
function isQuarterHour(controller){const t=Number(controller?.scheduledTime||Date.now());return new Date(t).getUTCMinutes()%15===0}

const STATUS_UI=String.raw`<style id="alyzia-status-model-test-css">
.flight-home-row .v2-status,.flight-detail-status-wrap .v2-status,.flight-head .v2-status{display:inline-flex!important}
</style><script id="alyzia-status-model-test-js">(()=>{'use strict';
if(window.__alyziaStatusModelTest)return;window.__alyziaStatusModelTest=true;
const txt=v=>String(v??'').trim(),up=v=>txt(v).toUpperCase();
const flights=()=>{try{return Array.isArray(FLIGHTS)?FLIGHTS:(Array.isArray(window.FLIGHTS)?window.FLIGHTS:[])}catch{return Array.isArray(window.FLIGHTS)?window.FLIGHTS:[]}};
const rowIndex=row=>{const raw=String(row.getAttribute('onclick')||row.querySelector('[onclick]')?.getAttribute('onclick')||'');const m=raw.match(/openFlightFromHomeList\((\d+)\)/);if(m)return Number(m[1]);const d=row.getAttribute('data-flight-index')||row.querySelector('[data-flight-index]')?.getAttribute('data-flight-index');return d!==null&&d!==''?Number(d):null};
const cls=s=>{s=up(s);if(s.startsWith('ARRIVÉ'))return'arrive';if(s.startsWith('ATTERRI'))return'decolle';if(s.startsWith('EN VOL'))return'envol';if(s==='PARTI')return'decolle';if(s.includes('RETARD'))return'retarde';if(s.includes('EMBAR'))return'embarquement';return'alheure'};
const remain=x=>{if(up(x?.status)!=='EN VOL')return'';const t=Date.parse(txt(x?.statusArrivalUtc));if(!t)return'';const n=Math.max(0,Math.ceil((t-Date.now())/60000));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')};
const label=x=>{const s=txt(x?.status)||"À L'HEURE";if(up(s)==='EN VOL'){const r=remain(x);return r?'EN VOL · RESTE '+r:'EN VOL'}return s};
const setBadge=(b,x)=>{if(!b||!x)return;const l=label(x),wanted='v2-status '+cls(l);if(txt(b.textContent)!==l)b.textContent=l;if(b.className!==wanted)b.className=wanted;b.style.display='inline-flex'};
function syncList(){const list=flights();for(const row of document.querySelectorAll('#app .flight-home-row')){const i=rowIndex(row),x=Number.isInteger(i)?list[i]:null;if(x)setBadge(row.querySelector('.v2-status'),x)}}
function current(){try{if(typeof FLIGHTS!=='undefined'&&Array.isArray(FLIGHTS)&&typeof selected!=='undefined'&&FLIGHTS[selected])return FLIGHTS[selected]}catch{}try{if(Array.isArray(window.FLIGHTS)&&Number.isInteger(window.selected))return window.FLIGHTS[window.selected]||null}catch{}return null}
function syncDetail(){const x=current(),head=document.querySelector('#app .flight-head');if(!x||!head)return;setBadge(head.querySelector('.flight-detail-status-wrap .v2-status')||head.querySelector('.v2-status'),x)}
function key(x){return txt(x?.identity||x?.flight_id)||[up(x?.flight||x?.flight_number),txt(x?.flight_date||x?.date)].join('|')}
function merge(incoming){const list=flights(),by=new Map(list.map(x=>[key(x),x]));for(const n of incoming){const x=by.get(key(n));if(!x)continue;for(const k of ['status','statusSource','statusReason','statusEvidence','statusArrivalUtc','statusModelEvidence','parisAeroportPhase'])if(n?.[k]!==undefined)x[k]=n[k]}}
async function refresh(){try{const r=await fetch('/api/flights',{cache:'no-store'});if(!r.ok)return;const j=await r.json(),a=Array.isArray(j)?j:Array.isArray(j?.flights)?j.flights:Array.isArray(j?.items)?j.items:[];if(a.length){merge(a);syncList();syncDetail()}}catch{}}
const run=()=>{syncList();syncDetail()};const start=()=>{run();setTimeout(refresh,800);setInterval(refresh,30000);setInterval(run,30000);const root=document.getElementById('app');if(root)new MutationObserver(run).observe(root,{childList:true,subtree:true})};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();</script>`;

const PUSH_UI=String.raw`<script id="alyzia-push-all-public-js">(()=>{'use strict';
window.adminPushNow=async function(){
 const btn=document.getElementById('adminPushBtn'),msg=document.getElementById('adnPushMsg');
 if(btn){btn.disabled=true;btn.textContent='⚡ SOURCES…'}if(msg)msg.textContent='STA + ETD + ATD/TAKEOFF/LANDING/ATA + STATUS TEST + GATE + TYPE/IMMAT en cours…';
 try{const r=await fetch('/api/admin/push-now',{method:'POST',cache:'no-store'}),j=await r.json();if(!j?.ok)throw new Error(j?.error||('HTTP '+r.status));
 const sta=j.filled??0,etd=j.etd?.updated??0,live=j.live?.updated??0,recovery=j.live?.recovery?.updated??0,paris=j.live?.parisAeroport?.updated??0,status=j.statusModel?.updated??j.live?.statusModel?.updated??0,regFix=(j.live?.regFix?.updated??0)+(j.ground?.regFix?.updated??0),ground=j.ground?.updated??0;
 if(msg)msg.textContent='✓ PUSH · STA '+sta+' · ETD '+etd+' · LIVE '+live+' · PARIS '+paris+' · STATUS TEST '+status+' · IMMAT '+regFix+' · GATE/TYPE/IMMAT '+ground+' · RECOVERY '+recovery;
 await window.renderAdminDashboard?.(true);
 }catch(e){if(msg)msg.textContent='ÉCHEC : '+(e?.message||e)}finally{if(btn){btn.disabled=false;btn.textContent='⚡ PUSH'}}
};
})();</script>`;
function stripStatusConflicts(html){return String(html||'')
 .replace(/<style id="alyzia-status-disabled-css">[\s\S]*?<\/style>/g,'')
 .replace(/<script id="alyzia-status-disabled-js">[\s\S]*?<\/script>/g,'')
 .replace(/<script id="alyzia-active-card-ops-fix">[\s\S]*?<\/script>/g,'')
 .replace(/<script id="alyzia-flight-status-authoritative-js">[\s\S]*?<\/script>/g,'')
 .replace(/<script id="alyzia-flight-list-live-sync-js">[\s\S]*?<\/script>/g,'')
 .replace(/<script id="alyzia-flight-runtime-stability-js">[\s\S]*?<\/script>/g,'');}
function patchHtml(html){let s=stripStatusConflicts(html);const inserts=[];if(!s.includes('id="alyzia-status-model-test-js"'))inserts.push(STATUS_UI);if(!s.includes('id="alyzia-push-all-public-js"'))inserts.push(PUSH_UI);if(!inserts.length)return s;const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+inserts.join('\n')+'\n'+s.slice(i):s+inserts.join('\n')}

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
    if(url.pathname==="/api/admin/live-public-sources")return json({ok:true,sources:{...LIVE_PUBLIC_SOURCE_ORDER,statusModel:STATUS_MODEL_TEST_RULES},statusMode:'TEST',fr24DirectStatus:false,cadenceMinutes:5});
    if(url.pathname==="/api/admin/status-model-test"){
      try{return json(await runStatusModelTest(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/ground-public-flow"){
      try{return json(await runGround(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/ground-public-status"){
      try{return json(await groundPublicStatus(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/push-now"&&request.method==="POST"){
      try{
        const base=await app.fetch(request,env,ctx);let sta={};try{sta=await base.clone().json()}catch{}
        const [etd,live,ground]=await Promise.all([runEtd(env),runLive(env,{limit:36,concurrency:4}),runGround(env)]);
        const statusModel=await runStatusModelTest(env);
        return json({...sta,ok:base.ok&&etd.ok&&live.ok&&ground.ok&&statusModel.ok,etd,live,ground,statusModel,statusMode:'TEST'});
      }catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    const response=await app.fetch(request,env,ctx);const type=String(response.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html'))return response;
    const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store');return new Response(patchHtml(await response.text()),{status:response.status,statusText:response.statusText,headers});
  },
  scheduled(controller,env,ctx){
    if(typeof app.scheduled==="function")app.scheduled(controller,env,ctx);
    ctx.waitUntil((async()=>{await runEtd(env).catch(()=>{});await runLive(env,{limit:12,concurrency:3}).catch(()=>{});if(isQuarterHour(controller))await runGround(env).catch(()=>{});await runStatusModelTest(env).catch(()=>{})})());
  }
};
