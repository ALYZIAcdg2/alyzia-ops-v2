import {auditFlightData,listCancelled} from "./admin-data-audit.js";
import app from "./v2-admin-all-public-sources-wrapper.js";
import {ETD_PUBLIC_SOURCE_ORDER} from "./etd-public-flow.js";
import {runEtdPublicFlowSafe,etdPublicStatusSafe} from "./etd-public-runner.js";
import {normalizeFr24EtdLocalTime} from "./etd-fr24-localtime.js";
import {runGroundPublicFlow,groundPublicStatus} from "./ground-public-flow.js";
import {runPublicLiveFlow,runLiveForFlight,publicLiveStatus,LIVE_PUBLIC_SOURCE_ORDER} from "./ops-public-live-flow-optimized.js";
import {recoverValidatedLiveFacts} from "./ops-public-live-validated-recovery.js";
import {recoverFlightAwareExactHistory} from "./flightaware-exact-history.js";
import {runPublicSourceCandidateTest,CANDIDATE_PUBLIC_SOURCES} from "./public-source-candidate-test.js";
import {runCoreSourceDiagnosticTest} from "./core-source-diagnostic-test.js";
import {backfillBoardGates} from "./fr24-board-backfill.js";
import {sweepBoardToday} from "./fr24-board-sweep.js";
import {sweepFidsToday} from "./fids-atd-sweep.js";
import {loadRuntimeState,saveRuntimeState} from "./runtime-state.js";
import {sanitizeArrivalClocks} from "./ops-arrival-sanitizer.js";
import {runFlighteraBoardTest} from "./flightera-board-test.js";
import {runFidsWidgetTest} from "./fids-widget-test.js";
import {runFidsCompare} from "./fids-compare.js";
import {runTimesCompare} from "./times-compare.js";
import {sanitizeTodayRegistrations} from "./ops-reg-sanitizer.js";
import {runParisAirportStatusFlow} from "./paris-airport-status-flow.js";
import {runStatusModelTest,STATUS_MODEL_TEST_RULES} from "./status-model-test.js";

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}})}
async function runEtd(env){const cleanup=await normalizeFr24EtdLocalTime(env);const flow=await runEtdPublicFlowSafe(env);return {...flow,localTimeFix:cleanup}}
async function runLive(env,opts){
  const flightAwareExact=await recoverFlightAwareExactHistory(env);
  const live=await runPublicLiveFlow(env,opts);
  // Tableau FR24 de CDG : porte, immat, type, ETD, décollage de TOUS les vols du jour (l'index est en cache, aucune requête de plus).
  const boardSweep=await sweepBoardToday(env).catch(()=>null);
  // Flux FIDS flightradar.live : ATD manquant des vols partis (remplacé par FlightStats / FlightAware quand ils répondent).
  const fidsSweep=await sweepFidsToday(env).catch(()=>null);
  const recovery=await recoverValidatedLiveFacts(env);
  const parisAeroport=await runParisAirportStatusFlow(env);
  const regFix=await sanitizeTodayRegistrations(env);
  const arrivalFix=await sanitizeArrivalClocks(env).catch(()=>null);
  const statusModel=await runStatusModelTest(env);
  return {...live,boardSweep,fidsSweep,arrivalFix,flightAwareExact,recovery,parisAeroport,regFix,statusModel};
}
async function runGround(env){const ground=await runGroundPublicFlow(env);const regFix=await sanitizeTodayRegistrations(env);return {...ground,regFix}}
async function runAllSequential(env,{liveLimit=36,liveConcurrency=4,withGround=true}={}){
  const etd=await runEtd(env);
  const live=await runLive(env,{limit:liveLimit,concurrency:liveConcurrency});
  const ground=withGround?await runGround(env):{ok:true,skipped:true};
  const statusModel=await runStatusModelTest(env);
  return {etd,live,ground,statusModel};
}
const CRON_LOCK_MS=100000;
async function acquireCronLock(env){
  try{
    await env.OPS_DB.prepare(`CREATE TABLE IF NOT EXISTS ops_meta(k TEXT PRIMARY KEY,v TEXT)`).run();
    const r=await env.OPS_DB.prepare(`SELECT v FROM ops_meta WHERE k='v2_cron_lock'`).first();
    if(Date.now()-(Number(r?.v)||0)<CRON_LOCK_MS)return false;
    await env.OPS_DB.prepare(`INSERT INTO ops_meta(k,v) VALUES('v2_cron_lock',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).bind(String(Date.now())).run();
    return true;
  }catch{return true}
}
async function releaseCronLock(env){try{await env.OPS_DB.prepare(`INSERT INTO ops_meta(k,v) VALUES('v2_cron_lock','0') ON CONFLICT(k) DO UPDATE SET v='0'`).run()}catch{}}
// The cron fires on even minutes only: the quarter-hour window is minutes 0-1 of each quarter (0, 16, 30, 46), so it is hit exactly once per quarter.
function isDailyCheckWindow(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));const m=Number(p.hour)*60+Number(p.minute);return m>=180&&m<360}
function isQuarterHour(controller){const t=Number(controller?.scheduledTime||Date.now());return new Date(t).getUTCMinutes()%15<2}

const PUSH_UI=String.raw`<script id="alyzia-push-all-public-js">(()=>{'use strict';
window.adminPushNow=async function(){
 const btn=document.getElementById('adminPushBtn'),msg=document.getElementById('adnPushMsg');
 if(btn){btn.disabled=true;btn.textContent='⚡ SOURCES…'}if(msg)msg.textContent='STA + ETD + LIVE + GATE + TYPE/IMMAT + STATUS V1 en cours…';
 try{const r=await fetch('/api/admin/push-now',{method:'POST',cache:'no-store'}),j=await r.json();if(!j?.ok)throw new Error(j?.error||('HTTP '+r.status));
 const sta=j.filled??0,etd=j.etd?.updated??0,live=j.live?.updated??0,fa=j.live?.flightAwareExact?.success??0,paris=j.live?.parisAeroport?.updated??0,status=j.statusModel?.updated??j.live?.statusModel?.updated??0,ground=j.ground?.updated??0;
 if(msg)msg.textContent='✓ PUSH · STA '+sta+' · ETD '+etd+' · LIVE '+live+' · FLIGHTAWARE EXACT '+fa+' · PARIS '+paris+' · STATUS V1 '+status+' · GATE/TYPE/IMMAT '+ground;
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
 .replace(/<script id="alyzia-flight-runtime-stability-js">[\s\S]*?<\/script>/g,'')
 .replace(/<style id="alyzia-status-model-test-css">[\s\S]*?<\/style>/g,'')
 .replace(/<script id="alyzia-status-model-test-js">[\s\S]*?<\/script>/g,'');}
function patchHtml(html){let s=stripStatusConflicts(html);if(s.includes('id="alyzia-push-all-public-js"'))return s;const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+PUSH_UI+'\n'+s.slice(i):s+PUSH_UI}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==="/api/admin/etd-public-flow"){
      try{return json(await runEtd(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/etd-public-status"){
      try{return json(await etdPublicStatusSafe(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/daily-check"){
      // POST: runs one batch of the daily control now (all sources, yesterday + today flights not yet checked today). GET: nothing is run, shows how many remain.
      try{
        if(request.method==="POST")return json(await runPublicLiveFlow(env,{limit:Number(url.searchParams.get("limit")||12),concurrency:4,recheck:true}));
        return json({ok:true,info:"POST /api/admin/daily-check?limit=12 runs a batch; the cron does it every 2 minutes between 03:00 and 06:00 Paris"});
      }catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/live-one"){
      // GET: what the live flow would read and write for one flight (nothing is saved). POST: applies it now, like a cron run.
      try{return json(await runLiveForFlight(env,{date:url.searchParams.get("date")||"",flight:url.searchParams.get("flight")||"",dryRun:request.method!=="POST"}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/cancelled"&&request.method==="GET"){
      try{return json(await listCancelled(env,{from:url.searchParams.get("from")||"",to:url.searchParams.get("to")||""}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/data-audit"){
      // GET: read-only audit of local clocks and flight dates (from / to = YYYY-MM-DD, default yesterday..tomorrow). POST ?repair=1: fixes dates and UTC clocks.
      try{return json(await auditFlightData(env,{from:url.searchParams.get("from")||"",to:url.searchParams.get("to")||"",repair:request.method==="POST"&&url.searchParams.get("repair")==="1"}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/etd-public-sources")return json({ok:true,sources:ETD_PUBLIC_SOURCE_ORDER,cadenceMinutes:2});
    if(url.pathname==="/api/admin/board-backfill"&&request.method==="GET"){
      // Rattrapage / contrôle des portes, immatriculations et types depuis le tableau FR24 de CDG. Sans apply=1 : aperçu seulement.
      try{return json(await backfillBoardGates(env,{date:url.searchParams.get("date")||"",apply:url.searchParams.get("apply")==="1",fields:url.searchParams.get("fields")||"gate,reg,type",replace:url.searchParams.get("replace")==="1"}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/times-compare"&&request.method==="GET"){
      // Lecture seule : ETD / ETA de nos vols du jour comparés au tableau FR24, au flux FIDS et à FR24 par vol (une lecture FR24 par vol).
      try{return json(await runTimesCompare(env,{limit:Number(url.searchParams.get("limit")||12),offset:Number(url.searchParams.get("offset")||0)}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/fids-compare"&&request.method==="GET"){
      // Lecture seule : compare le flux FIDS flightradar.live à nos vols du jour (ATD, décollage, porte).
      try{return json(await runFidsCompare(env,{flight:url.searchParams.get("flight")||""}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/fids-widget-test"&&request.method==="GET"){
      // Lecture seule : script du widget FIDS flightradar.live (CDG départs) et ses adresses de données.
      try{return json(await runFidsWidgetTest({flight:url.searchParams.get("flight")||""}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/flightera-board-test"&&request.method==="GET"){
      // Lecture seule : une page du tableau des départs Flightera de CDG, pour voir si elle répond depuis le Worker.
      try{return json(await runFlighteraBoardTest({date:url.searchParams.get("date")||"",time:url.searchParams.get("time")||"00_00"}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/core-source-diagnostic"&&request.method==="GET"){
      try{return json(await runCoreSourceDiagnosticTest({date:url.searchParams.get('date')||'',flight:url.searchParams.get('flight')||'',origin:url.searchParams.get('origin')||'CDG',destination:url.searchParams.get('destination')||''}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/public-source-candidate-test"&&request.method==="GET"){
      try{return json(await runPublicSourceCandidateTest({date:url.searchParams.get('date')||'',flight:url.searchParams.get('flight')||'',destination:url.searchParams.get('destination')||''}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/public-source-candidates"){
      if(request.method==="GET")return json({ok:true,activeCycle:false,sources:CANDIDATE_PUBLIC_SOURCES.map(({key,label})=>({key,label}))});
      if(request.method==="POST"){
        try{const body=await request.clone().json().catch(()=>({}));return json(await runPublicSourceCandidateTest({date:body?.date||url.searchParams.get('date')||'',flight:body?.flight||url.searchParams.get('flight')||'',destination:body?.destination||url.searchParams.get('destination')||''}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
      }
    }
    if(url.pathname==="/api/admin/live-public-flow"){
      try{return json(await runLive(env,{limit:24,concurrency:3}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/live-public-status"){
      try{return json(await publicLiveStatus(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/live-public-sources")return json({ok:true,sources:{...LIVE_PUBLIC_SOURCE_ORDER,statusModel:STATUS_MODEL_TEST_RULES},statusMode:'V1_LOGIC_V2_PUBLIC_SOURCES',apis:false,cadenceMinutes:2});
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
        return json({...sta,ok:base.ok&&etd.ok&&live.ok&&ground.ok&&statusModel.ok,etd,live,ground,statusModel,statusMode:'V1_LOGIC_V2_PUBLIC_SOURCES',apis:false,writeMode:'SEQUENTIAL'});
      }catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    const response=await app.fetch(request,env,ctx);const type=String(response.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html'))return response;
    const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store');return new Response(patchHtml(await response.text()),{status:response.status,statusText:response.statusText,headers});
  },
  scheduled(controller,env,ctx){
    if(typeof app.scheduled==="function")app.scheduled(controller,env,ctx);
    ctx.waitUntil((async()=>{
      // The cron runs every 2 minutes: a run still in progress (lock younger than 100 s) is not doubled.
      if(!(await acquireCronLock(env)))return;
      try{
        // Pauses FlightStats et cache du tableau FR24 : relus ici, réécrits à la fin (la mémoire du Worker peut être vide à chaque passage).
        await loadRuntimeState(env);
        // Live facts (ATD, takeoff, landing…) first: they are the most time-critical; the ETD pass over every flight can be long.
        await runLive(env,{limit:18,concurrency:4}).catch(()=>{});
        await runEtd(env).catch(()=>{});
        if(isQuarterHour(controller))await runGround(env).catch(()=>{});
        // Daily control: between 03:00 and 06:00 Paris, every flight of yesterday and today is re-read by all sources, a batch per run, to correct times if needed.
        if(isDailyCheckWindow())await runPublicLiveFlow(env,{limit:12,concurrency:4,recheck:true}).catch(()=>{});
        await runStatusModelTest(env).catch(()=>{});
      }finally{await saveRuntimeState(env);await releaseCronLock(env)}
    })());
  }
};
