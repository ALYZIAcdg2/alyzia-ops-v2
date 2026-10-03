import app from "./flight-list-live-sync-wrapper.js";

const RUNTIME=String.raw`<script id="alyzia-flight-runtime-stability-js">(()=>{
'use strict';
if(window.__alyziaFlightRuntimeStability)return;window.__alyziaFlightRuntimeStability=true;
const txt=v=>String(v??'').trim(),up=v=>txt(v).toUpperCase();
const first=(x,keys)=>{for(const k of keys){const v=txt(x?.[k]);if(v&&!/^(?:—|-|N\/A|NULL|UNKNOWN)$/i.test(v))return v}return ''};
const validReg=v=>{const s=up(v);if(!s||/^(?:ON[ -]?TIME|SCHEDULED|DELAYED|DEPARTED|ARRIVED|LANDED|IN[ -]?AIR|AIRBORNE|EN[ -]?VOL|PREVU|PRÉVU|RETARDE|RETARDÉ|PARTI|N\/A|NULL|UNKNOWN)$/i.test(s))return '';return /^(?:F-[A-Z]{4}|TC-[A-Z]{3}|TS-[A-Z]{3}|SU-[A-Z]{3}|CC-[A-Z]{3}|9V-[A-Z]{3}|9M-[A-Z]{3}|EI-[A-Z]{3}|SP-[A-Z]{3}|YU-[A-Z]{3}|LZ-[A-Z]{3}|9XR-[A-Z0-9]{2,3}|N\d{1,5}[A-Z]{0,2}|[A-Z]{1,2}-[A-Z0-9]{3,5})$/.test(s)?s:''};
const flights=()=>{try{return Array.isArray(FLIGHTS)?FLIGHTS:(Array.isArray(window.FLIGHTS)?window.FLIGHTS:[])}catch{return Array.isArray(window.FLIGHTS)?window.FLIGHTS:[]}};
const rowIndex=row=>{const raw=String(row.getAttribute('onclick')||row.querySelector('[onclick]')?.getAttribute('onclick')||'');const m=raw.match(/openFlightFromHomeList\((\d+)\)/);if(m)return Number(m[1]);const d=row.getAttribute('data-flight-index')||row.querySelector('[data-flight-index]')?.getAttribute('data-flight-index');return d!==null&&d!==''?Number(d):null};
const trustedStoredStatus=x=>{const src=up(x?.statusSource||x?.status_source||x?.opsStatusSource||'');return /PARIS_AEROPORT|PUBLIC_LIVE|FLIGHTAWARE|FR24|FLIGHTSTATS|PLANEFINDER|OPENSKY|OAG|VALIDATED_LIVE/.test(src)?txt(x?.status):''};
const hh=v=>{const m=txt(v).match(/(\d{1,2}):(\d{2})/);return m?{h:Number(m[1]),m:Number(m[2])}:null};
const serviceDate=x=>txt(x?.flight_date||x?.flightDate||x?.service_date_internal||x?.serviceDate||x?.date)||(()=>{try{return typeof HOME_DATE!=='undefined'?txt(HOME_DATE):''}catch{return''}})();
const dayNumber=d=>{const m=txt(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?Math.floor(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]))/86400000):null};
const tzOf=code=>{const k=up(code);try{if(typeof TZ!=='undefined'&&TZ&&Number.isFinite(Number(TZ[k])))return Number(TZ[k])}catch{}try{if(window.TZ&&Number.isFinite(Number(window.TZ[k])))return Number(window.TZ[k])}catch{}return k==='CDG'?2:null};
const absoluteUtcMinute=(date,localTime,offset)=>{const d=dayNumber(date),t=hh(localTime);if(d==null||!t||offset==null)return null;return d*1440+t.h*60+t.m-offset*60};
const arrivalUtcMinute=x=>{const date=serviceDate(x),origin=up(x?.origin||x?.dep||'CDG'),dest=up(x?.destination||x?.dest||''),dep=first(x,['takeoff','takeoffTime','takeoff_time','atd','actualDeparture','actual_departure','std']),arr=first(x,['eta','estimatedArrival','estimated_arrival','sta']);const depOff=tzOf(origin),arrOff=tzOf(dest);let a=absoluteUtcMinute(date,dep,depOff),b=absoluteUtcMinute(date,arr,arrOff);if(a==null||b==null)return null;while(b<a)b+=1440;return b};
const nowUtcMinute=()=>Date.now()/60000;
const fmtRemain=min=>{const n=Math.max(0,Math.ceil(min));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')};
const airborneEvidence=x=>{const raw=up([x?.opsStatus,x?.flight_status,x?.providerStatusRaw,trustedStoredStatus(x)].filter(Boolean).join(' '));return Boolean(first(x,['takeoff','takeoffTime','takeoff_time','airborne'])||/EN VOL|IN AIR|AIRBORNE|IN FLIGHT|EN ROUTE|TOOK OFF|DÉCOLLÉ|DECOLLE/.test(raw))};
const statusOf=x=>{if(!x)return '';
 const raw=up([x.opsStatus,x.flight_status,x.providerStatusRaw,trustedStoredStatus(x)].filter(Boolean).join(' '));
 if(/CANCEL|ANNUL/.test(raw))return 'ANNULÉ';
 if(first(x,['ata','actualArrival','actual_arrival','gateIn','gate_in']))return 'ARRIVÉ';
 if(first(x,['landing','landingTime','landing_time','touchdown'])||/LANDED|ATTERI|POSÉ|POSE A|POSÉ À/.test(raw))return 'ATTERI';
 if(airborneEvidence(x)){const arr=arrivalUtcMinute(x);if(arr!=null){const left=arr-nowUtcMinute();if(left<=-15)return 'ARRIVÉ';return 'EN VOL · RESTE '+fmtRemain(left)}return 'EN VOL'}
 if(first(x,['atd','actualDeparture','actual_departure','gateOut','gate_out'])||/DEPARTED|PARTI|GATE OUT/.test(raw))return 'PARTI';
 if(/EMBARQUEMENT\s+CLOS|BOARDING\s+CLOSED|GATE\s+CLOSED/.test(raw))return 'EMBARQUEMENT CLOS';
 if(/BOARD|EMBAR/.test(raw))return 'EMBARQUEMENT';
 if(/DELAY|RETARD/.test(raw))return 'RETARDÉ';
 return ''};
const cls=s=>{s=up(s);if(s.startsWith('ARRIVÉ'))return'arrive';if(s.startsWith('EN VOL'))return'envol';if(s==='PARTI'||s.includes('ATTERI'))return'decolle';if(s.includes('ANNUL'))return'annule';if(s.includes('RETARD'))return'retarde';if(s.includes('EMBAR'))return'embarquement';return'programme'};
const setBadge=(badge,label)=>{if(!badge||!label)return;const extra=badge.classList.contains('ops-time-alert')?' ops-time-alert':'';const wanted='v2-status '+cls(label)+extra;if(txt(badge.textContent)!==label)badge.textContent=label;if(badge.className!==wanted)badge.className=wanted};
function applyReg(row,x){const reg=validReg(first(x,['reg','registration','aircraftRegistration','aircraft_registration','immat','tailNumber','tail_number']));if(!reg)return;x.reg=reg;x.registration=reg;x.aircraftRegistration=reg;for(const m of row.querySelectorAll('.v2-metric')){const l=up(m.querySelector('.v2-metric-label')?.textContent);if(!/^(?:IMMAT|REG|REGISTRATION|IMMATRICULATION)$/.test(l))continue;const v=m.querySelector('.v2-metric-value');if(v&&txt(v.textContent)!==reg)v.textContent=reg}}
function syncList(){const list=flights();for(const row of document.querySelectorAll('#app .flight-home-row')){const i=rowIndex(row),x=Number.isInteger(i)?list[i]:null;if(!x)continue;setBadge(row.querySelector('.v2-status'),statusOf(x));applyReg(row,x)}}
function currentFlight(){try{if(typeof FLIGHTS!=='undefined'&&Array.isArray(FLIGHTS)&&typeof selected!=='undefined'&&FLIGHTS[selected])return FLIGHTS[selected]}catch{}try{if(Array.isArray(window.FLIGHTS)&&Number.isInteger(window.selected))return window.FLIGHTS[window.selected]||null}catch{}return null}
function syncDetail(){const x=currentFlight(),head=document.querySelector('#app .flight-head');if(!x||!head)return;const badge=head.querySelector('.flight-detail-status-wrap .v2-status')||head.querySelector('.v2-status');setBadge(badge,statusOf(x))}
function key(x){return txt(x?.identity||x?.flight_id)||[up(x?.flight||x?.flight_number),txt(x?.flight_date||x?.date)].join('|')}
function mergeLive(incoming){const list=flights(),by=new Map(list.map(x=>[key(x),x]));for(const n of incoming){const x=by.get(key(n));if(!x)continue;for(const k of ['atd','actualDeparture','actual_departure','takeoff','takeoffTime','takeoff_time','airborne','landing','landingTime','landing_time','ata','actualArrival','actual_arrival','eta','estimatedArrival','estimated_arrival','sta','status','statusSource','status_source','opsStatus','flight_status','providerStatusRaw','reg','registration','aircraftRegistration','aircraft_registration','immat','tailNumber','tail_number'])if(n?.[k]!==undefined&&n?.[k]!==null&&txt(n[k])!=='')x[k]=n[k]}}
async function refreshLive(){try{const r=await fetch('/api/flights',{cache:'no-store'});if(!r.ok)return;const j=await r.json(),a=Array.isArray(j)?j:Array.isArray(j?.flights)?j.flights:Array.isArray(j?.items)?j.items:[];if(a.length){mergeLive(a);syncList();syncDetail()}}catch{}}
let queued=false;const run=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;syncList();syncDetail()})};
const start=()=>{run();setTimeout(refreshLive,800);setInterval(refreshLive,30000);setInterval(run,5000);const root=document.getElementById('app');if(root)new MutationObserver(()=>run()).observe(root,{childList:true,subtree:true})};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();</script>`;
function stripConflicts(html){return String(html||'').replace(/<script id="alyzia-active-card-ops-fix">[\s\S]*?<\/script>/g,'').replace(/<script id="alyzia-flight-status-authoritative-js">[\s\S]*?<\/script>/g,'')}
function patch(html){let s=stripConflicts(html);if(s.includes('id="alyzia-flight-runtime-stability-js"'))return s;const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+RUNTIME+'\n'+s.slice(i):s+RUNTIME}
export default{async fetch(request,env,ctx){const r=await app.fetch(request,env,ctx);const t=String(r.headers.get('content-type')||'').toLowerCase();if(!t.includes('text/html'))return r;const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');return new Response(patch(await r.text()),{status:r.status,statusText:r.statusText,headers:h})},scheduled(controller,env,ctx){if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx)}};
