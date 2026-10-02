import app from "./ui-first-paint-wrapper.js";
import {flightOperationalStatus} from "./flight-operational-status.js";
import {handlePublicWebConsolidation} from "./public-web-consolidation-routes.js";

const OPS_LIST_V4=String.raw`
<style id="alyzia-ops-list-v4-css">
#app .flight-home-row .v2-time-grid.ops-list-v4{grid-template-columns:repeat(3,minmax(0,1fr))!important}
#app .flight-home-row .v2-time-grid.ops-list-v4 .v2-time-cell{min-width:0!important}
#app .flight-home-row .v2-time-grid.ops-list-v4 .v2-time-cell+.v2-time-cell{border-left:1px solid #dce5ee!important;padding-left:9px!important}
#app .flight-home-row .v2-time-grid.ops-list-v4 .v2-time-label{font-size:10px!important;font-weight:950!important}
#app .flight-home-row .v2-time-grid.ops-list-v4 .v2-time-value{font-size:24px!important;white-space:nowrap!important}
#app .flight-home-row .v2-flight-stack[data-ops-status-ready]>.v2-status:not(.v4-status){display:none!important}
#app .flight-home-row .v4-status.status-annule{background:#111!important;color:#ff3347!important}
#app .flight-home-row .v4-status.status-prevu{background:#e7f2ff!important;color:#086bc1!important}
#app .flight-home-row .v4-status.status-retarde{background:#fff0dc!important;color:#c25e00!important}
#app .flight-home-row .v4-status.status-decolle,#app .flight-home-row .v4-status.status-en-vol{background:#e1f6eb!important;color:#087443!important}
#app .flight-home-row .v4-status.status-atteri,#app .flight-home-row .v4-status.status-arrivee{background:#dff7ef!important;color:#06785c!important}
@media(max-width:620px){
 #app .flight-home-row .v2-time-grid.ops-list-v4 .v2-time-cell+.v2-time-cell{padding-left:5px!important}
 #app .flight-home-row .v2-time-grid.ops-list-v4 .v2-time-label{font-size:8px!important}
 #app .flight-home-row .v2-time-grid.ops-list-v4 .v2-time-value{font-size:17px!important}
}
</style>
<script id="alyzia-ops-list-v4-js">(()=>{
'use strict';
if(window.__alyziaOpsListV4)return;window.__alyziaOpsListV4=true;
const txt=v=>String(v??'').trim();
const up=v=>txt(v).toUpperCase();
const hh=v=>{const m=txt(v).match(/(?:^|\s)(\d{1,2}):(\d{2})(?:\s|$)/);return m?String(m[1]).padStart(2,'0')+':'+m[2]:''};
const mins=v=>{const m=hh(v).match(/^(\d{2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null};
const delta=(a,b)=>{const x=mins(a),y=mins(b);if(x==null||y==null)return null;let d=y-x;if(d<-720)d+=1440;if(d>720)d-=1440;return d};
const flights=()=>{try{if(typeof FLIGHTS!=='undefined'&&Array.isArray(FLIGHTS))return FLIGHTS}catch{}return Array.isArray(window.FLIGHTS)?window.FLIGHTS:[]};
const rowIndex=row=>{const src=String(row.getAttribute('onclick')||row.querySelector('.home-open')?.getAttribute('onclick')||'');const m=src.match(/openFlightFromHomeList\((\d+)\)/);return m?Number(m[1]):null};
const flightNo=v=>up(v).replace(/\s+/g,'');
const getFlight=row=>{const list=flights(),i=rowIndex(row);if(i!==null&&list[i])return list[i];const shown=flightNo(row.querySelector('.v2-flight,.home-flight')?.textContent||'');return list.find(x=>flightNo(x.flight||x.flight_number)===shown)||null};
const scheduleFor=x=>{try{if(typeof schedule==='function')return schedule(x)||{}}catch{}try{if(typeof window.schedule==='function')return window.schedule(x)||{}}catch{}return {}};
const val=(x,keys)=>{for(const k of keys){const v=txt(x?.[k]);if(v)return v}return ''};
const statusOf=${flightOperationalStatus.toString()};
const statusClass=s=>'status-'+s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]+/g,'-').replace(/^-|-$/g,'');
const cell=(label,value,tone='')=>'<div class="v2-time-cell"><div class="v2-time-label">'+label+'</div><div class="v2-time-value '+tone+'">'+(value||'—')+'</div></div>';
function patchGrid(grid,signature,html){if(!grid||grid.dataset.opsV4===signature)return;grid.classList.add('ops-list-v4');grid.innerHTML=html;grid.dataset.opsV4=signature}
function patchRow(row){
 const x=getFlight(row);if(!x||!row.querySelector('.v2-card'))return;
 const sched=scheduleFor(x);
 const std=hh(val(x,['std','scheduledDeparture','scheduled_departure'])||sched.std);
 const etd=hh(val(x,['etd','edt','estimatedDeparture','estimated_departure']));
 const atd=hh(val(x,['atd','actualDeparture','actual_departure','gateOut','gate_out']));
 const sta=hh(val(x,['sta','scheduledArrival','scheduled_arrival'])||sched.sta);
 const eta=hh(val(x,['eta','estimatedArrival','estimated_arrival']));
 const ata=hh(val(x,['ata','actualArrival','actual_arrival','gateIn','gate_in']));
 const boxes=row.querySelectorAll('.v2-timebox');
 const depSig=[std,etd,atd].join('|'),arrSig=[sta,eta,ata].join('|');
 patchGrid(boxes[0]?.querySelector('.v2-time-grid'),depSig,cell('STD',std)+cell('ETD',etd,etd?'warn':'')+cell('ATD',atd,atd?'ok':''));
 patchGrid(boxes[1]?.querySelector('.v2-time-grid'),arrSig,cell('STA',sta)+cell('ETA',eta,eta?'neutral':'')+cell('ATA',ata,ata?'ok':''));
 const stack=row.querySelector('.v2-flight-stack');if(!stack)return;
 const s=statusOf(x);
 let badge=stack.querySelector('.v4-status');if(!badge){badge=document.createElement('span');stack.appendChild(badge)}
 const cls='v2-status v4-status '+statusClass(s);if(badge.textContent!==s)badge.textContent=s;if(badge.className!==cls)badge.className=cls;stack.dataset.opsStatusReady='1';
}
const run=()=>document.querySelectorAll('#app .flight-home-row').forEach(row=>{try{patchRow(row)}catch{}});
const scheduleRun=()=>{requestAnimationFrame(run);setTimeout(run,80);setTimeout(run,350)};
function installHook(){
 try{if(typeof renderHome==='function'&&!renderHome.__alyziaOpsListV4){const original=renderHome;const wrapped=function(...args){const out=original.apply(this,args);scheduleRun();return out};wrapped.__alyziaOpsListV4=true;renderHome=wrapped;return true}}catch{}
 try{if(typeof window.renderHome==='function'&&!window.renderHome.__alyziaOpsListV4){const original=window.renderHome;const wrapped=function(...args){const out=original.apply(this,args);scheduleRun();return out};wrapped.__alyziaOpsListV4=true;window.renderHome=wrapped;return true}}catch{}
 return false;
}
let tries=0;const boot=()=>{scheduleRun();if(!installHook()&&tries++<40)setTimeout(boot,250)};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
document.addEventListener('click',()=>setTimeout(run,120),true);
window.addEventListener('pageshow',scheduleRun);
setInterval(run,15000);
})();</script>`;

function patchOpsList(html){
  const s=String(html||'');
  if(s.includes('id="alyzia-ops-list-v4-js"'))return s;
  const i=s.lastIndexOf('</body>');
  return i>=0?s.slice(0,i)+OPS_LIST_V4+'\n'+s.slice(i):s+OPS_LIST_V4;
}

export default {
  async fetch(request,env,ctx){
    const routed=await handlePublicWebConsolidation(request,env,ctx);
    if(routed)return routed;
    const response=await app.fetch(request,env,ctx);
    const type=String(response.headers.get('content-type')||'').toLowerCase();
    if(!type.includes('text/html'))return response;
    const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store');
    return new Response(patchOpsList(await response.text()),{status:response.status,statusText:response.statusText,headers});
  },
  scheduled(controller,env,ctx){
    if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx);
  }
};

