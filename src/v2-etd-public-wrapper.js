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
import {sweepFidsToday,getFeed,loadFidsState} from "./fids-atd-sweep.js";
import {syncCabinAfterAircraftChange} from "./cabin-sync.js";
import {loadRuntimeState,saveRuntimeState} from "./runtime-state.js";
import {sanitizeArrivalClocks} from "./ops-arrival-sanitizer.js";
import {runFlighteraBoardTest} from "./flightera-board-test.js";
import {flightStatsStatus} from "./flightstats-status.js";
import {missingAtdReport} from "./missing-atd.js";
import {probeFlightStats} from "./flightstats-probe.js";
import {flightAwareStatus,probeFlightAware} from "./flightaware-probe.js";
import {runFidsWidgetTest} from "./fids-widget-test.js";
import {runFidsCompare} from "./fids-compare.js";
import {runCabinConfigAudit} from "./cabin-config-audit.js";
import {runFidsPages} from "./fids-pages-test.js";
import {runTimesCompare} from "./times-compare.js";
import {sanitizeTodayRegistrations} from "./ops-reg-sanitizer.js";
import {runParisAirportStatusFlow,probeParisAirport} from "./paris-airport-status-flow.js";
import {probeGatenavo} from "./gatenavo-probe.js";
import {restoreRegs} from "./reg-restore.js";
import {readFlightState} from "./flight-state-probe.js";
import {setManualBoarding} from "./manual-boarding.js";
import {runStatusModelTest,STATUS_MODEL_TEST_RULES} from "./status-model-test.js";

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}})}
async function runEtd(env){const cleanup=await normalizeFr24EtdLocalTime(env);const flow=await runEtdPublicFlowSafe(env);return {...flow,localTimeFix:cleanup}}
async function runLive(env,opts){
  const flightAwareExact=await recoverFlightAwareExactHistory(env);
  // Flux FIDS d'abord : ATD / ATA de tous les vols en un appel, pour que le passage par vol ne lise FlightStats / FlightAware que pour ce qui manque encore.
  const fidsSweep=await sweepFidsToday(env).catch(()=>null);
  const live=await runPublicLiveFlow(env,opts);
  // Tableau FR24 de CDG : porte, immat, type, ETD, décollage de TOUS les vols du jour (l'index est en cache, aucune requête de plus).
  const boardSweep=await sweepBoardToday(env).catch(()=>null);
  // Config cabine automatique alignée sur le type réel quand un appareil a changé (sans action dans la fiche).
  const cabinSync=await syncCabinAfterAircraftChange(env).catch(e=>({ok:false,error:String(e?.message||e)}));
  const recovery=await recoverValidatedLiveFacts(env);
  const parisAeroport=await runParisAirportStatusFlow(env);
  const regFix=await sanitizeTodayRegistrations(env);
  const arrivalFix=await sanitizeArrivalClocks(env).catch(()=>null);
  const statusModel=await runStatusModelTest(env);
  return {...live,boardSweep,cabinSync,fidsSweep,arrivalFix,flightAwareExact,recovery,parisAeroport,regFix,statusModel};
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

const READ_ONE_UI=String.raw`<script id="alyzia-read-one-js">(()=>{'use strict';
// Lecture à la demande d'un seul vol (FlightStats / FlightAware compris), depuis la fiche vol. Mêmes requêtes que le cron, pauses et cooldowns respectés.
function cur(){try{if(typeof FLIGHTS!=='undefined'&&Array.isArray(FLIGHTS)&&typeof selected!=='undefined'&&FLIGHTS[selected])return FLIGHTS[selected]}catch{}try{if(Array.isArray(window.FLIGHTS)&&Number.isInteger(window.selected))return window.FLIGHTS[window.selected]||null}catch{}return null}
async function run(btn){const x=cur();if(!x)return;const fl=String(x.flight||x.flight_number||x.designator||'').replace(/\s+/g,''),date=String(x.date||x.flightDate||(typeof HOME_DATE!=='undefined'?HOME_DATE:'')||'');if(!fl)return;
 const old=btn.textContent;btn.disabled=true;btn.textContent='Lecture…';let out='';
 try{const r=await fetch('/api/admin/live-one?flight='+encodeURIComponent(fl)+(date?'&date='+encodeURIComponent(date):''),{method:'POST',cache:'no-store'}),j=await r.json();
  if(j?.error==='TOO_SOON')out='Déjà lu à l’instant · réessaie dans '+j.retryInSeconds+' s';
  else if(!j?.ok)out='Échec : '+(j?.error||('HTTP '+r.status));
  else{const a=(j.result?.attempts||[]).map(z=>z.source+' '+(z.httpStatus||z.status)).join(' · ');out='Lu · '+(j.result?.status||'')+(a?' · '+a:'')}
 }catch(e){out='Échec : '+(e?.message||e)}
 btn.disabled=false;btn.title=out;btn.textContent=out.length>34?out.slice(0,33)+'\u2026':out;setTimeout(()=>{btn.textContent=old},9000);
 try{await window.renderAdminDashboard?.(true)}catch{}try{window.refreshFlights?.()}catch{}}
function ensure(){const bar=document.querySelector('#app .v2x-d-actions');if(!bar||bar.querySelector('.read-one-btn'))return;const b=document.createElement('button');b.type='button';b.className='v2x-act read-one-btn';b.textContent='\u21BB RELIRE LES SOURCES';b.title='Relire ce vol sur toutes les sources (FlightStats / FlightAware compris)';b.onclick=()=>run(b);bar.insertBefore(b,bar.querySelector('.v2x-act.danger')||null)}
new MutationObserver(ensure).observe(document.documentElement,{childList:true,subtree:true});ensure();
})();</script>`;

const BOARDING_UI=String.raw`<script id="alyzia-boarding-js">(()=>{'use strict';
// Embarquement manuel depuis la fiche vol : prioritaire sur les sources automatiques, levé par l'ATD.
function cur(){try{if(typeof FLIGHTS!=='undefined'&&Array.isArray(FLIGHTS)&&typeof selected!=='undefined'&&FLIGHTS[selected])return FLIGHTS[selected]}catch{}try{if(Array.isArray(window.FLIGHTS)&&Number.isInteger(window.selected))return window.FLIGHTS[window.selected]||null}catch{}return null}
async function run(btn,phase,label){const x=cur();if(!x)return;const fl=String(x.flight||x.flight_number||x.designator||'').replace(/\s+/g,''),date=String(x.date||x.flightDate||(typeof HOME_DATE!=='undefined'?HOME_DATE:'')||'');if(!fl)return;
 const old=btn.textContent;btn.disabled=true;btn.textContent='…';let out='';
 try{const r=await fetch('/api/admin/boarding?flight='+encodeURIComponent(fl)+'&phase='+encodeURIComponent(phase)+(date?'&date='+encodeURIComponent(date):''),{method:'POST',cache:'no-store'}),j=await r.json();
  out=j?.ok?'OK · '+(j.status||''):j?.error==='ALREADY_DEPARTED'?'Vol déjà parti':'Échec : '+(j?.error||('HTTP '+r.status))}
 catch(e){out='Échec : '+(e?.message||e)}
 btn.disabled=false;btn.textContent=out.length>26?out.slice(0,25)+'…':out;setTimeout(()=>{btn.textContent=old},5000);
 try{await window.renderAdminDashboard?.(true)}catch{}try{window.refreshFlights?.()}catch{}}
function ensure(){const bar=document.querySelector('#app .v2x-d-actions');if(!bar||bar.querySelector('.boarding-btn'))return;const at=bar.querySelector('.v2x-act.danger')||null;
 for(const [phase,label,title] of [['EMBARQUEMENT','✈ EMBARQUEMENT','Embarquement en cours (saisie manuelle)'],['EMBARQUEMENT CLOS','✈ EMBARQ. CLOS','Embarquement clos (saisie manuelle)'],['CLEAR','✕ EFFACER EMBARQ.','Retirer la saisie manuelle d’embarquement']]){
  const b=document.createElement('button');b.type='button';b.className='v2x-act boarding-btn';b.textContent=label;b.title=title;b.onclick=()=>run(b,phase,label);bar.insertBefore(b,at)}}
new MutationObserver(ensure).observe(document.documentElement,{childList:true,subtree:true});ensure();
})();</script>`;

const REG_RESTORE_UI=String.raw`<script id="alyzia-reg-restore-js">(()=>{'use strict';
// Bouton ADMIN : restaure les immatriculations perdues depuis le journal du tableau FR24 (aperçu, confirmation, application).
const esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function ensureModalCss(){if(document.getElementById('alz-modal-css'))return;const st=document.createElement('style');st.id='alz-modal-css';st.textContent=
 '.alz-ov{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,31,61,.5);backdrop-filter:blur(2px)}'+
 '.alz-modal{width:100%;max-width:520px;max-height:86vh;display:flex;flex-direction:column;background:#fff;border-radius:20px;box-shadow:0 24px 70px rgba(10,31,61,.35);padding:22px 22px 18px;color:#0a1f3d}'+
 '.alz-modal h3{margin:0 0 14px;font-size:20px;font-weight:900;letter-spacing:.2px;text-transform:uppercase}'+
 '.alz-body{overflow:auto;display:grid;gap:14px;padding-right:2px}'+
 '.alz-sec small{display:block;margin-bottom:6px;font-size:11px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;color:#5f7897}'+
 '.alz-rows{display:grid;gap:6px}'+
 '.alz-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 12px;border-radius:12px;background:#f2f6fb;font-weight:800}'+
 '.alz-row b{font-size:15px}.alz-row span{font-size:14px;padding:3px 9px;border-radius:8px;border:1px solid transparent}'+
 '.alz-bad .alz-row span{background:#ffe1e5;color:#b3243b;border-color:#f3b5bf}.alz-good .alz-row span{background:#e1f5e9;color:#16794a;border-color:#b6e2c8}.alz-muted .alz-row span{background:#eef3f9;color:#426382;border-color:#d6e1ee}'+
 '.alz-act{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}'+
 '.alz-btn{border:1px solid #cfe0f3;background:#eef5fd;color:#1769c9;border-radius:12px;padding:11px 18px;font-size:14px;font-weight:900;letter-spacing:.3px;text-transform:uppercase;cursor:pointer}'+
 '.alz-btn.primary{background:#1769c9;border-color:#1769c9;color:#fff}.alz-btn:focus-visible{outline:3px solid #9cc4f2;outline-offset:2px}';
 document.head.appendChild(st)}
function appModal({title,sections=[],ok='OK',cancel='Annuler'}){ensureModalCss();return new Promise(res=>{
 const ov=document.createElement('div');ov.className='alz-ov';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
 ov.innerHTML='<div class="alz-modal"><h3>'+esc(title)+'</h3><div class="alz-body">'+sections.map(s=>'<div class="alz-sec alz-'+esc(s.tone||'muted')+'"><small>'+esc(s.label)+'</small><div class="alz-rows">'+(s.rows||[]).slice(0,60).map(r=>'<div class="alz-row"><b>'+esc(r[0])+'</b><span>'+esc(r[1])+'</span></div>').join('')+((s.rows||[]).length>60?'<div class="alz-row"><b>…</b><span>+'+((s.rows||[]).length-60)+'</span></div>':'')+'</div></div>').join('')+'</div><div class="alz-act"><button type="button" class="alz-btn" data-k="0">'+esc(cancel)+'</button><button type="button" class="alz-btn primary" data-k="1">'+esc(ok)+'</button></div></div>';
 const done=v=>{document.removeEventListener('keydown',key,true);ov.remove();res(v)},key=e=>{if(e.key==='Escape'){e.stopPropagation();done(false)}};
 ov.addEventListener('click',e=>{if(e.target===ov)done(false);const b=e.target.closest?.('[data-k]');if(b)done(b.dataset.k==='1')});
 document.addEventListener('keydown',key,true);document.body.appendChild(ov);ov.querySelector('[data-k="1"]')?.focus()})}
function dateOf(){const v=document.getElementById('adminDateInput')?.value;return /^\d{4}-\d{2}-\d{2}$/.test(v||'')?v:'';}
async function run(btn){const msg=document.getElementById('adnPushMsg'),date=dateOf(),q=date?('?date='+encodeURIComponent(date)):'',old=btn.textContent;
 const say=t=>{if(msg)msg.textContent=t;btn.title=t};
 btn.disabled=true;btn.textContent='IMMAT…';
 try{const r=await fetch('/api/admin/reg-restore'+q,{cache:'no-store'}),j=await r.json();if(!j?.ok)throw new Error(j?.error||('HTTP '+r.status));
  if(!j.toRestore&&!j.toClear){say('Aucune immatriculation à nettoyer ni à restaurer ('+(j.date||date||'aujourd’hui')+')');return}
  const ok=await appModal({title:'Immatriculations — '+(j.date||date||''),sections:[
    j.toClear?{label:'À nettoyer ('+j.toClear+')',tone:'bad',rows:(j.clearItems||[]).map(i=>[i.flight,i.reg])}:null,
    j.toRestore?{label:'À restaurer depuis le tableau FR24 ('+j.toRestore+')',tone:'good',rows:(j.items||[]).map(i=>[i.flight,i.reg])}:null,
    (j.skipped||[]).length?{label:'Ignorées : doublon proche ('+(j.skipped||[]).length+')',tone:'muted',rows:(j.skipped||[]).map(s=>[s.flight,s.reg||''])}:null
  ].filter(Boolean),ok:'Appliquer',cancel:'Annuler'});
  if(!ok)return say('Restauration annulée');
  const r2=await fetch('/api/admin/reg-restore'+q,{method:'POST',cache:'no-store'}),k=await r2.json();if(!k?.ok)throw new Error(k?.error||('HTTP '+r2.status));
  say('✓ IMMAT nettoyées : '+(k.cleared??0)+' · restaurées : '+(k.restored??0)+' · ignorées : '+((k.skipped||[]).length));
  try{await window.renderAdminDashboard?.(true)}catch{}
 }catch(e){say('ÉCHEC : '+(e?.message||e))}finally{btn.disabled=false;btn.textContent=old}}
function ensure(){const push=document.getElementById('adminPushBtn');if(!push||document.getElementById('adminRegRestoreBtn'))return;const b=document.createElement('button');b.type='button';b.id='adminRegRestoreBtn';b.className=push.className;b.textContent='↺ IMMAT';b.title='Nettoyer les mauvaises immatriculations (D-AIHV) et restaurer celles perdues (tableau FR24)';b.onclick=()=>run(b);push.insertAdjacentElement('afterend',b)}
new MutationObserver(ensure).observe(document.documentElement,{childList:true,subtree:true});ensure();
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
function patchHtml(html){let s=stripStatusConflicts(html);if(s.includes('id="alyzia-push-all-public-js"'))return s;const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+PUSH_UI+'\n'+READ_ONE_UI+'\n'+BOARDING_UI+'\n'+REG_RESTORE_UI+'\n'+s.slice(i):s+PUSH_UI+READ_ONE_UI+BOARDING_UI+REG_RESTORE_UI}

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
    if(url.pathname==="/api/admin/boarding"&&request.method==="POST"){
      // Embarquement saisi à la main depuis la fiche vol : phase=EMBARQUEMENT | EMBARQUEMENT CLOS | CLEAR.
      try{return json(await setManualBoarding(env,{date:url.searchParams.get("date")||"",flight:url.searchParams.get("flight")||"",phase:url.searchParams.get("phase")||""}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/flight-state"&&request.method==="GET"){
      // Lecture seule : heures d'un vol avec leur source et le journal des écritures (décollage, atterrissage, ATA, ATD).
      try{return json(await readFlightState(env,{date:url.searchParams.get("date")||"",flight:url.searchParams.get("flight")||""}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/reg-restore"){
      // GET : aperçu des immatriculations qui seraient restaurées depuis le journal (tableau FR24). POST : applique.
      try{return json(await restoreRegs(env,{date:url.searchParams.get("date")||"",dryRun:request.method!=="POST"}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/live-one"){
      // GET: what the live flow would read and write for one flight (nothing is saved). POST: applies it now, like a cron run.
      try{return json(await runLiveForFlight(env,{date:url.searchParams.get("date")||"",flight:url.searchParams.get("flight")||"",dryRun:request.method!=="POST",onDemand:request.method==="POST"}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
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
      try{return json(await runTimesCompare(env,{limit:Number(url.searchParams.get("limit")||12),offset:Number(url.searchParams.get("offset")||0),all:url.searchParams.get("all")==="1"}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/flightstats-probe"&&request.method==="GET"){
      // Diagnostic à la demande : 1 à 3 requêtes FlightStats (page de suivi, API légère, page flight-details) pour voir laquelle répond depuis le Worker.
      try{return json(await probeFlightStats({airline:url.searchParams.get("airline")||"",number:url.searchParams.get("number")||"",date:url.searchParams.get("date")||"",flightId:url.searchParams.get("flightId")||"",headersMode:url.searchParams.get("headers")||"",debug:url.searchParams.get("debug")==="1"}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/flightaware-status"&&request.method==="GET"){
      // Lecture seule : lectures FlightAware du jour par vol (aucun appel FlightAware).
      try{return json(await flightAwareStatus(env,{date:url.searchParams.get("date")||""}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/flightaware-probe"&&request.method==="GET"){
      // Diagnostic à la demande : 2 requêtes FlightAware (page du vol puis historique exact).
      try{return json(await probeFlightAware({designator:url.searchParams.get("designator")||"",date:url.searchParams.get("date")||"",std:url.searchParams.get("std")||"",origin:url.searchParams.get("origin")||"CDG",destination:url.searchParams.get("destination")||""}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/provider-refusals"&&request.method==="GET"){
      // Lecture seule : derniers refus (403 / 429 / erreurs) reçus par le cron de FlightStats et FlightAware : adresse, code, Retry-After et début de la réponse.
      try{const row=await env.OPS_DB.prepare(`SELECT v FROM ops_meta WHERE k='provider_refusals_v1'`).first();let list=[];try{list=JSON.parse(row?.v||"[]")}catch{}const bySource={};for(const e of list){const k=e.source+" "+e.status;bySource[k]=(bySource[k]||0)+1}return json({ok:true,mode:"PROVIDER_REFUSALS_NO_WRITE",count:list.length,bySource,last:list.slice(-15)})}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/missing-atd"&&request.method==="GET"){
      // Lecture seule : vols du jour partis depuis plus de 20 min sans ATD, avec l'état de FIDS, FlightStats et FlightAware pour chacun.
      try{return json(await missingAtdReport(env,{date:url.searchParams.get("date")||""}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/flightstats-status"&&request.method==="GET"){
      // Lecture seule : disjoncteurs FlightStats enregistrés + dernières lectures par vol du jour (aucun appel FlightStats).
      try{return json(await flightStatsStatus(env,{date:url.searchParams.get("date")||""}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/fids-status"&&request.method==="GET"){
      // Lecture seule : dernière lecture FIDS enregistrée + lecture directe du flux (fenêtre de départs couverte) + simulation du passage sans écriture.
      try{
        const state=await loadFidsState(env),counts={};for(const v of Object.values(state?.flights||{}))counts[v]=(counts[v]||0)+1;
        const feed=await getFeed(),times=(feed.rows||[]).map(r=>String(r.dep_time||"")).filter(Boolean).sort();
        const dry=await sweepFidsToday(env,{dryRun:true});
        return json({ok:true,mode:"FIDS_STATUS_NO_WRITE",nowUtc:new Date().toISOString(),saved:state?{at:state.at,status:state.status,http:state.http,tracked:counts}:null,feed:{status:feed.status,httpStatus:feed.httpStatus||null,rows:feed.rows?.length||0,firstDep:times[0]||null,lastDep:times[times.length-1]||null},dryRun:dry});
      }catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/fids-pages"&&request.method==="GET"){
      // Lecture seule : pages par vol de FIDS (vol:destination:STD) comparées à la ligne du flux général.
      try{return json(await runFidsPages({list:url.searchParams.get("list")||"",date:url.searchParams.get("date")||""}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/paris-aeroport-status"&&request.method==="GET"){
      // Lecture seule : test de la lecture structurée Paris Aéroport (statuts embarquement) face à nos vols du jour.
      try{return json(await probeParisAirport(env))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/gatenavo-probe"&&request.method==="GET"){
      // Lecture seule : accès et couverture de la page départs CDG de Gatenavo (statuts embarquement).
      try{return json(await probeGatenavo(env,{flight:url.searchParams.get("flight")||""}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/cabin-config-audit"&&request.method==="GET"){
      // Lecture seule : type d'appareil de chaque vol face au catalogue des plans cabine (seatmap).
      try{return json(await runCabinConfigAudit(env,{date:url.searchParams.get("date")||""}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/fids-compare"&&request.method==="GET"){
      // Lecture seule : compare le flux FIDS flightradar.live à nos vols du jour (ATD, décollage, porte).
      try{return json(await runFidsCompare(env,{flight:url.searchParams.get("flight")||"",date:url.searchParams.get("date")||""}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
    }
    if(url.pathname==="/api/admin/fids-widget-test"&&request.method==="GET"){
      // Lecture seule : script du widget FIDS flightradar.live (CDG départs) et ses adresses de données.
      try{return json(await runFidsWidgetTest({flight:url.searchParams.get("flight")||"",dest:url.searchParams.get("dest")||"",std:url.searchParams.get("std")||"",date:url.searchParams.get("date")||""}))}catch(error){return json({ok:false,error:String(error?.message||error)},500)}
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
