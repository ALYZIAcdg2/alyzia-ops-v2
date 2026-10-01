import app from "./public-results-entry-wrapper.js";

const UI=String.raw`
<style id="alyzia-flight-list-ops-v3-css">
#app .v2-time-grid.ops-v3-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
#app .v2-time-grid.ops-v3-grid .v2-time-cell{min-width:0!important}
#app .v2-time-grid.ops-v3-grid .v2-time-cell+.v2-time-cell{border-left:1px solid #dce5ee!important;padding-left:10px!important}
#app .v2-time-grid.ops-v3-grid .v2-time-label{font-size:11px!important;font-weight:950!important}
#app .v2-time-grid.ops-v3-grid .v2-time-value{font-size:25px!important;white-space:nowrap!important}
#app .v2-status.status-annule{background:#111!important;color:#ff3347!important}
#app .v2-status.status-prevu{background:#e7f2ff!important;color:#086bc1!important}
#app .v2-status.status-retarde{background:#fff0dc!important;color:#c25e00!important}
#app .v2-status.status-decolle,#app .v2-status.status-en-vol{background:#e1f6eb!important;color:#087443!important}
#app .v2-status.status-atteri,#app .v2-status.status-arrivee{background:#dff7ef!important;color:#06785c!important}
@media(max-width:620px){
 #app .v2-time-grid.ops-v3-grid .v2-time-cell+.v2-time-cell{padding-left:6px!important}
 #app .v2-time-grid.ops-v3-grid .v2-time-label{font-size:9px!important}
 #app .v2-time-grid.ops-v3-grid .v2-time-value{font-size:19px!important}
}
</style>
<script id="alyzia-flight-list-ops-v3-js">(()=>{
'use strict';
if(window.__alyziaFlightListOpsV3)return;window.__alyziaFlightListOpsV3=true;
const txt=v=>String(v??'').trim();
const up=v=>txt(v).toUpperCase();
const hh=v=>{const m=txt(v).match(/(?:^|\s)(\d{1,2}):(\d{2})(?:\s|$)/);return m?String(m[1]).padStart(2,'0')+':'+m[2]:txt(v)||'—'};
const mins=v=>{const m=hh(v).match(/^(\d{2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null};
const delta=(a,b)=>{const x=mins(a),y=mins(b);if(x==null||y==null)return null;let d=y-x;if(d<-720)d+=1440;if(d>720)d-=1440;return d};
const flights=()=>{try{if(typeof FLIGHTS!=='undefined'&&Array.isArray(FLIGHTS))return FLIGHTS}catch{}return Array.isArray(window.FLIGHTS)?window.FLIGHTS:[]};
const rowIndex=row=>{const src=String(row.getAttribute('onclick')||row.querySelector('.home-open')?.getAttribute('onclick')||'');const m=src.match(/openFlightFromHomeList\((\d+)\)/);return m?Number(m[1]):null};
const flightNo=v=>up(v).replace(/\s+/g,'');
const getFlight=row=>{const list=flights(),i=rowIndex(row);if(i!==null&&list[i])return list[i];const shown=flightNo(row.querySelector('.v2-flight,.home-flight')?.textContent||'');return list.find(x=>flightNo(x.flight||x.flight_number)===shown)||null};
const scheduleFor=x=>{try{if(typeof schedule==='function')return schedule(x)||{}}catch{}try{if(typeof window.schedule==='function')return window.schedule(x)||{}}catch{}return {}};
const val=(x,keys)=>{for(const k of keys){const v=txt(x?.[k]);if(v)return v}return ''};
const statusOf=x=>{
 const raw=up(val(x,['opsStatus','status','flight_status','providerStatusRaw']));
 if(/CANCEL|ANNUL/.test(raw))return 'ANNULÉ';
 const ata=val(x,['ata','actualArrival','actual_arrival','gateIn','gate_in']);
 const landing=val(x,['landing','landingTime','landing_time','touchdown']);
 const takeoff=val(x,['takeoff','takeoffTime','takeoff_time','airborne']);
 const atd=val(x,['atd','actualDeparture','actual_departure','gateOut','gate_out']);
 if(ata)return 'ARRIVÉE';
 if(landing)return 'ATTERI';
 if(takeoff)return 'EN VOL';
 if(atd)return 'DECOLLE';
 const std=val(x,['std','scheduledDeparture','scheduled_departure']);
 const etd=val(x,['etd','edt','estimatedDeparture','estimated_departure']);
 const d=etd?delta(std,etd):null;
 if(/DELAY|RETARD/.test(raw)||(d!=null&&d>=5))return 'RETARDÉ';
 return 'PRÉVU';
};
const statusClass=s=>'status-'+s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]+/g,'-').replace(/^-|-$/g,'');
const cell=(label,value,kind)=>'<div class="v2-time-cell"><div class="v2-time-label">'+label+'</div><div class="v2-time-value '+kind+'">'+(value||'—')+'</div></div>';
function patchRow(row){
 const x=getFlight(row);if(!x)return;
 const sched=scheduleFor(x);
 const std=hh(val(x,['std','scheduledDeparture','scheduled_departure'])||sched.std);
 const etd=hh(val(x,['etd','edt','estimatedDeparture','estimated_departure']));
 const atd=hh(val(x,['atd','actualDeparture','actual_departure','gateOut','gate_out']));
 const sta=hh(val(x,['sta','scheduledArrival','scheduled_arrival'])||sched.sta);
 const eta=hh(val(x,['eta','estimatedArrival','estimated_arrival']));
 const ata=hh(val(x,['ata','actualArrival','actual_arrival','gateIn','gate_in']));
 const boxes=row.querySelectorAll('.v2-timebox');
 if(boxes[0]){let g=boxes[0].querySelector('.v2-time-grid');if(g){g.classList.add('ops-v3-grid');g.innerHTML=cell('STD',std,'')+cell('ETD',etd,etd!=='—'?'warn':'')+cell('ATD',atd,atd!=='—'?'ok':'')}}
 if(boxes[1]){let g=boxes[1].querySelector('.v2-time-grid');if(g){g.classList.add('ops-v3-grid');g.innerHTML=cell('STA',sta,'')+cell('ETA',eta,eta!=='—'?'neutral':'')+cell('ATA',ata,ata!=='—'?'ok':'')}}
 const badge=row.querySelector('.v2-status');if(badge){const s=statusOf(x);badge.textContent=s;badge.className='v2-status '+statusClass(s)}
}
const run=()=>document.querySelectorAll('#app .flight-home-row').forEach(patchRow);
const start=()=>{run();const root=document.getElementById('app')||document.documentElement;new MutationObserver(()=>run()).observe(root,{childList:true,subtree:true});setInterval(run,15000)};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();</script>`;

function patch(html){const s=String(html||'');if(s.includes('id="alyzia-flight-list-ops-v3-js"'))return s;const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+UI+'\n'+s.slice(i):s+UI}
export default {async fetch(request,env,ctx){const r=await app.fetch(request,env,ctx),t=String(r.headers.get('content-type')||'').toLowerCase();if(!t.includes('text/html'))return r;const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');return new Response(patch(await r.text()),{status:r.status,statusText:r.statusText,headers:h})},scheduled(c,e,x){if(typeof app.scheduled==='function')return app.scheduled(c,e,x)}};
