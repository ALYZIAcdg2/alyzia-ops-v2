import app from "./flight-status-authoritative-wrapper.js";

const UI=String.raw`<script id="alyzia-flight-list-live-sync-js">(()=>{
'use strict';
if(window.__alyziaFlightListLiveSync)return;window.__alyziaFlightListLiveSync=true;
const txt=v=>String(v??'').trim(),up=v=>txt(v).toUpperCase();
const flights=()=>{try{return Array.isArray(FLIGHTS)?FLIGHTS:(Array.isArray(window.FLIGHTS)?window.FLIGHTS:[])}catch{return Array.isArray(window.FLIGHTS)?window.FLIGHTS:[]}};
const rowIndex=row=>{const raw=String(row.getAttribute('onclick')||row.querySelector('[onclick]')?.getAttribute('onclick')||'');const m=raw.match(/openFlightFromHomeList\((\d+)\)/);if(m)return Number(m[1]);const d=row.getAttribute('data-flight-index')||row.querySelector('[data-flight-index]')?.getAttribute('data-flight-index');return d!==null&&d!==''?Number(d):null};
const first=(x,keys)=>{for(const k of keys){const v=txt(x?.[k]);if(v&&!/^(?:—|-|N\/A|NULL|UNKNOWN)$/i.test(v))return v}return ''};
const validReg=v=>{const s=up(v);if(!s||/^(?:ON[ -]?TIME|SCHEDULED|DELAYED|DEPARTED|ARRIVED|LANDED|IN[ -]?AIR|AIRBORNE|EN[ -]?VOL|PREVU|PRÉVU|RETARDE|RETARDÉ|PARTI|N\/A|NULL|UNKNOWN)$/i.test(s))return '';return s};
const statusOf=x=>{
 if(!x)return '';
 const raw=up([x.opsStatus,x.flight_status,x.providerStatusRaw].filter(Boolean).join(' '));
 if(/CANCEL|ANNUL/.test(raw))return 'ANNULÉ';
 if(first(x,['ata','actualArrival','actual_arrival','gateIn','gate_in']))return 'ARRIVÉ';
 if(first(x,['landing','landingTime','landing_time','touchdown'])||/LANDED|ATTERI/.test(raw))return 'ATTERI';
 if(first(x,['takeoff','takeoffTime','takeoff_time','airborne'])||/EN VOL|IN AIR|AIRBORNE|IN FLIGHT|EN ROUTE|TOOK OFF/.test(raw))return 'EN VOL';
 if(first(x,['atd','actualDeparture','actual_departure','gateOut','gate_out'])||/DEPARTED|PARTI|GATE OUT/.test(raw))return 'PARTI';
 if(/BOARD|EMBAR/.test(raw))return 'EMBARQUEMENT';
 if(/DELAY|RETARD/.test(raw))return 'RETARDÉ';
 return '';
};
const cls=label=>{const s=up(label);if(s.startsWith('ARRIVÉ'))return'arrive';if(s.startsWith('EN VOL'))return'envol';if(s==='PARTI')return'decolle';if(s.includes('ATTERI'))return'decolle';if(s.includes('ANNUL'))return'annule';if(s.includes('RETARD'))return'retarde';if(s.includes('EMBAR'))return'embarquement';return'programme'};
function syncRow(row){const i=rowIndex(row),list=flights(),x=Number.isInteger(i)?list[i]:null;if(!x)return;
 const status=statusOf(x),badge=row.querySelector('.v2-status');if(status&&badge){const extra=badge.classList.contains('ops-time-alert')?' ops-time-alert':'';const wanted='v2-status '+cls(status)+extra;if(txt(badge.textContent)!==status)badge.textContent=status;if(badge.className!==wanted)badge.className=wanted}
 const reg=validReg(first(x,['reg','registration','aircraftRegistration','aircraft_registration','immat','tailNumber','tail_number']));
 if(reg){x.reg=reg;x.registration=reg;x.aircraftRegistration=reg;for(const m of row.querySelectorAll('.v2-metric')){const label=up(m.querySelector('.v2-metric-label')?.textContent);if(!/^(?:IMMAT|REG|REGISTRATION|IMMATRICULATION)$/.test(label))continue;const v=m.querySelector('.v2-metric-value');if(v&&txt(v.textContent)!==reg)v.textContent=reg}}
}
let running=false;const run=()=>{if(running)return;running=true;try{document.querySelectorAll('#app .flight-home-row').forEach(syncRow)}finally{running=false}};
const start=()=>{run();const root=document.getElementById('app')||document.documentElement;new MutationObserver(()=>queueMicrotask(run)).observe(root,{childList:true,subtree:true,characterData:true});setInterval(run,5000)};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();</script>`;
function patch(html){const s=String(html||'');if(s.includes('id="alyzia-flight-list-live-sync-js"'))return s;const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+UI+'\n'+s.slice(i):s+UI}
export default{async fetch(request,env,ctx){const r=await app.fetch(request,env,ctx);const t=String(r.headers.get('content-type')||'').toLowerCase();if(!t.includes('text/html'))return r;const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');return new Response(patch(await r.text()),{status:r.status,statusText:r.statusText,headers:h})},scheduled(controller,env,ctx){if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx)}};
