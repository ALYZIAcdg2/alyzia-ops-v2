import app from "./v2-admin-all-public-sources-wrapper.js";
import {ETD_PUBLIC_SOURCE_ORDER} from "./etd-public-flow.js";
import {runEtdPublicFlowSafe,etdPublicStatusSafe} from "./etd-public-runner.js";
import {normalizeFr24EtdLocalTime} from "./etd-fr24-localtime.js";
import {runGroundPublicFlow,groundPublicStatus} from "./ground-public-flow.js";
import {runPublicLiveFlow,publicLiveStatus,LIVE_PUBLIC_SOURCE_ORDER} from "./ops-public-live-flow.js";
import {recoverValidatedLiveFacts} from "./ops-public-live-validated-recovery.js";
import {sanitizeTodayRegistrations} from "./ops-reg-sanitizer.js";
import {runParisAirportStatusFlow} from "./paris-airport-status-flow.js";
import {runFlightAwareStatusEvidence} from "./flightaware-status-evidence.js";
import {runStatusModelTest,STATUS_MODEL_TEST_RULES} from "./status-model-test.js";

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}})}
async function runEtd(env){const cleanup=await normalizeFr24EtdLocalTime(env);const flow=await runEtdPublicFlowSafe(env);return {...flow,localTimeFix:cleanup}}
async function runLive(env,opts){
  const live=await runPublicLiveFlow(env,opts);
  const recovery=await recoverValidatedLiveFacts(env);
  const parisAeroport=await runParisAirportStatusFlow(env);
  const flightAwareEvidence=await runFlightAwareStatusEvidence(env,{limit:opts?.limit||36,concurrency:opts?.concurrency||4});
  const regFix=await sanitizeTodayRegistrations(env);
  const statusModel=await runStatusModelTest(env);
  return {...live,recovery,parisAeroport,flightAwareEvidence,regFix,statusModel};
}
async function runGround(env){const ground=await runGroundPublicFlow(env);const regFix=await sanitizeTodayRegistrations(env);return {...ground,regFix}}
async function runAllSequential(env,{liveLimit=36,liveConcurrency=4,withGround=true}={}){
  const etd=await runEtd(env);
  const live=await runLive(env,{limit:liveLimit,concurrency:liveConcurrency});
  const ground=withGround?await runGround(env):{ok:true,skipped:true};
  const statusModel=await runStatusModelTest(env);
  return {etd,live,ground,statusModel};
}
function isQuarterHour(controller){const t=Number(controller?.scheduledTime||Date.now());return new Date(t).getUTCMinutes()%15===0}

const STATUS_UI=String.raw`<style id="alyzia-status-model-test-css">
.flight-home-row .v2-status,.flight-detail-status-wrap .v2-status,.flight-head .v2-status{display:inline-flex!important}
.flight-detail-status-wrap{display:flex!important;align-items:center;gap:8px;margin-top:7px;min-height:34px;flex-wrap:wrap}.flight-detail-status-wrap .v2-status{font-size:14px!important;padding:8px 13px!important}
.flight-detail-terminal{display:inline-flex;align-items:center;padding:8px 13px;border-radius:999px;background:#eef3f8;border:1px solid #dbe5ef;color:#28425f;font:900 14px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap}
.flight-detail-terminal.term-t1{background:#0a4aa8;border-color:#0a4aa8;color:#fff}.flight-detail-terminal.term-t2{background:#0d7a27;border-color:#0d7a27;color:#fff}.flight-detail-terminal.term-t3{background:#a80c66;border-color:#a80c66;color:#fff}
@media(max-width:620px){.flight-detail-status-wrap .v2-status,.flight-detail-terminal{font-size:12px!important;padding:7px 11px!important}}
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
function terminalOf(x){const raw=txt(x?.terminal||x?.departureTerminal||x?.departure_terminal||x?.terminalOrigin||x?.originTerminal||'');if(!raw)return'';const s=up(raw).replace(/^TERMINAL\s*/,'').replace(/^TERM\s*/,'');return s.startsWith('T')?s:'T'+s}
function ensureDetailWrap(head){let wrap=head.querySelector('.flight-detail-status-wrap');if(wrap)return wrap;const anchor=head.querySelector('.fh-id')||head.querySelector('.flight-id-with-logo')?.parentElement||head.firstElementChild;if(!anchor)return null;wrap=document.createElement('div');wrap.className='flight-detail-status-wrap';wrap.innerHTML='<span class="v2-status alheure">À L\'HEURE</span>';anchor.appendChild(wrap);return wrap}
function syncDetail(){const x=current(),head=document.querySelector('#app .flight-head');if(!x||!head)return;const wrap=ensureDetailWrap(head);if(!wrap)return;let badge=wrap.querySelector('.v2-status');if(!badge){badge=document.createElement('span');badge.className='v2-status alheure';wrap.appendChild(badge)}setBadge(badge,x);const term=terminalOf(x);let chip=wrap.querySelector('.flight-detail-terminal');if(term){if(!chip){chip=document.createElement('span');wrap.insertBefore(chip,badge)}chip.className='flight-detail-terminal term-'+term.toLowerCase();chip.textContent='TERM '+term}else if(chip)chip.remove()}
function key(x){return txt(x?.identity||x?.flight_id)||[up(x?.flight||x?.flight_number),txt(x?.flight_date||x?.date)].join('|')}
function merge(incoming){const list=flights(),by=new Map(list.map(x=>[key(x),x]));for(const n of incoming){const x=by.get(key(n));if(!x)continue;for(const k of ['status','statusSource','statusReason','statusEvidence','statusArrivalUtc','statusModelEvidence','parisAeroportPhase','terminal','departureTerminal','departure_terminal','terminalOrigin','originTerminal'])if(n?.[k]!==undefined)x[k]=n[k]}}
async function refresh(){try{const r=await fetch('/api/flights',{cache:'no-store'});if(!r.ok)return;const j=await r.json(),a=Array.isArray(j)?j:Array.isArray(j?.flights)?j.flights:Array.isArray(j?.items)?j.items:[];if(a.length){merge(a);syncList();syncDetail()}}catch{}}
const run=()=>{syncList();syncDetail()};const start=()=>{run();setTimeout(refresh,800);setInterval(refresh,30000);setInterval(run,30000);const root=document.getElementById('app');if(root)new MutationObserver(run).observe(root,{childList:true,subtree:true})};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();</script>`;

const PUSH_UI=String.raw`<script id="alyzia-push-all-public-js">(()=>{'use strict';
window.adminPushNow=async function(){
 const btn=document.getElementById('adminPushBtn'),msg=document.getElementById('adnPushMsg');
 if(btn){btn.disabled=true;btn.textContent='⚡ SOURCES…'}if(msg)msg.textContent='STA + ETD + ATD/TAKEOFF/LANDING/ATA + FLIGHTAWARE STATUS + GATE + TYPE/IMMAT en cours…';
 try{const r=await fetch('/api/admin/push-now',{method:'POST',cache:'no-store'}),j=await r.json();if(!j?.ok)throw new Error(j?.error||('HTTP '+r.status));
 const sta=j.filled??0,etd=j.etd?.updated??0,live=j.live?.updated??0,recovery=j.live?.recovery?.updated??0,paris=j.live?.parisAeroport?.updated??0,fa=j.live?.flightAwareEvidence?.updated??0,status=j.statusModel?.updated??j.live?.statusModel?.updated??0,regFix=(j.live?.regFix?.updated??0)+(j.ground?.regFix?.updated??0),ground=j.ground?.updated??0;
 if(msg)msg.textContent='✓ PUSH · STA '+sta+' · ETD '+etd+' · LIVE '+live+' · PARIS '+paris+' · FA STATUS '+fa+' · STATUS TEST '+status+' · IMMAT '+regFix+' · GATE/TYPE/IMMAT '+ground+' · RECOVERY '+recovery;
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
        const {etd,live,ground,statusModel}=await runAllSequential(env,{liveLimit:36,liveConcurrency:4,withGround:true});
        return json({...sta,ok:base.ok&&etd.ok&&live.ok&&ground.ok&&statusModel.ok,etd,live,ground,statusModel,statusMode:'TEST',writeMode:'SEQUENTIAL'});
      }catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    const response=await app.fetch(request,env,ctx);const type=String(response.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html'))return response;
    const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store');return new Response(patchHtml(await response.text()),{status:response.status,statusText:response.statusText,headers});
  },
  scheduled(controller,env,ctx){
    if(typeof app.scheduled==="function")app.scheduled(controller,env,ctx);
    ctx.waitUntil((async()=>{
      await runEtd(env).catch(()=>{});
      await runLive(env,{limit:12,concurrency:3}).catch(()=>{});
      if(isQuarterHour(controller))await runGround(env).catch(()=>{});
      await runStatusModelTest(env).catch(()=>{});
    })());
  }
};