import app from "./v2-etd-public-wrapper.js";

const UI=String.raw`<style id="alyzia-v2-single-status-css">
#app .alyzia-status-single{display:inline-flex!important;align-items:center;justify-content:center;margin-top:6px;padding:7px 11px;border-radius:999px;font-size:12px;font-weight:950;line-height:1;white-space:nowrap;background:#eef3f8;color:#607086}
#app .alyzia-status-single.envol,#app .alyzia-status-single.arrive{background:#ddf7e9;color:#07824f}
#app .alyzia-status-single.retarde{background:#fff0d8;color:#a85d00}
#app .alyzia-status-single.embarquement{background:#e7f1ff;color:#075fd3}
.flight-detail-status-wrap{display:flex!important;align-items:center;gap:8px;margin-top:7px;min-height:34px;flex-wrap:wrap}
.flight-detail-status-wrap .alyzia-status-single{font-size:14px!important;padding:8px 13px!important;margin-top:0}
@media(max-width:620px){.flight-detail-status-wrap .alyzia-status-single{font-size:12px!important;padding:7px 11px!important}}
</style><script id="alyzia-v2-ui-consistency-js">(()=>{'use strict';
if(window.__alyziaV2UiConsistency)return;window.__alyziaV2UiConsistency=true;
const txt=v=>String(v??'').trim(),up=v=>txt(v).toUpperCase();
let live=[];
const keyFlight=x=>up(x?.flight||x?.flight_number||x?.designator||'');
const statusLabel=x=>{
 const s=up(x?.status||'');if(!s)return'';
 if(s!=='EN VOL')return txt(x?.status)||'';
 const t=Date.parse(txt(x?.statusArrivalUtc));if(!t)return'EN VOL';
 const n=Math.max(0,Math.ceil((t-Date.now())/60000));
 return 'EN VOL · RESTE '+String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
};
const statusClass=s=>{s=up(s);if(s.startsWith('ARRIVÉ'))return'arrive';if(s.startsWith('EN VOL'))return'envol';if(s.includes('RETARD'))return'retarde';if(s.includes('EMBAR'))return'embarquement';return'decolle'};
function rowFlight(row){const direct=up(row.querySelector('.home-flight')?.textContent);if(direct)return direct;const m=up(row.textContent).match(/\b([A-Z0-9]{2,3}\d{2,4})\b/);return m?m[1]:''}
function flightForRow(row){const f=rowFlight(row);return f?live.find(x=>keyFlight(x)===f)||null:null}
function removeOldStatusNodes(scope){
 for(const n of scope.querySelectorAll('.v2-status,.flight-status,.home-status,.alyzia-list-status,.alyzia-status-single'))n.remove();
 for(const n of [...scope.querySelectorAll('span,div')]){
  if(n.children.length)continue;
  if(/^(PARTI|EN VOL(?:\s*·\s*RESTE\s*\d{2}:\d{2})?|ARRIVÉ|ATTERRI|RETARDÉ|EMBARQUEMENT(?: CLOS)?|À L['’]HEURE)$/i.test(txt(n.textContent)))n.remove();
 }
}
function dedupeHome(){
 const app=document.getElementById('app');if(!app)return null;
 const pages=[...app.querySelectorAll('.home-page')].filter(p=>p.querySelector('.flight-home-list'));if(!pages.length)return null;
 const visible=pages.filter(p=>getComputedStyle(p).display!=='none');
 const ranked=(visible.length?visible:pages).sort((a,b)=>b.querySelectorAll('.flight-home-row').length-a.querySelectorAll('.flight-home-row').length);
 const keep=ranked[0];for(const p of pages)if(p!==keep)p.remove();
 for(const host of keep.querySelectorAll('.home-table-scroll')){const lists=[...host.querySelectorAll(':scope > .flight-home-list')];if(lists.length>1){const best=[...lists].sort((a,b)=>b.querySelectorAll('.flight-home-row').length-a.querySelectorAll('.flight-home-row').length)[0];for(const l of lists)if(l!==best)l.remove()}}
 return keep;
}
function syncList(){
 const page=dedupeHome();if(!page)return;
 for(const row of page.querySelectorAll('.flight-home-row')){
  const x=flightForRow(row),label=statusLabel(x);if(!x||!label)continue;
  removeOldStatusNodes(row);
  const b=document.createElement('span');b.className='alyzia-status-single '+statusClass(label);b.textContent=label;
  const host=row.querySelector('.home-flight-cell > div')||row.querySelector('.home-flight-cell')||row.querySelector('.home-flight')?.parentElement||row;
  host.appendChild(b);
 }
}
function currentFlight(){try{if(typeof FLIGHTS!=='undefined'&&Array.isArray(FLIGHTS)&&typeof selected!=='undefined'&&FLIGHTS[selected]){const f=keyFlight(FLIGHTS[selected]);return live.find(x=>keyFlight(x)===f)||null}}catch{}return null}
function syncDetail(){
 const head=document.querySelector('#app .flight-head'),x=currentFlight();if(!head||!x)return;
 const label=statusLabel(x);if(!label)return;
 let wrap=head.querySelector('.flight-detail-status-wrap');
 if(!wrap){const anchor=head.querySelector('.fh-id')||head.querySelector('.flight-id-with-logo')?.parentElement||head.firstElementChild;if(!anchor)return;wrap=document.createElement('div');wrap.className='flight-detail-status-wrap';anchor.appendChild(wrap)}
 removeOldStatusNodes(wrap);
 const b=document.createElement('span');b.className='alyzia-status-single '+statusClass(label);b.textContent=label;wrap.appendChild(b);
}
function apply(){dedupeHome();syncList();syncDetail()}
async function refresh(){try{const r=await fetch('/api/flights',{cache:'no-store'});if(!r.ok)return;const j=await r.json();live=Array.isArray(j)?j:Array.isArray(j?.flights)?j.flights:Array.isArray(j?.items)?j.items:[];apply()}catch{}}
let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
function start(){refresh();setInterval(refresh,15000);setInterval(apply,5000);const root=document.getElementById('app');if(root)new MutationObserver(queue).observe(root,{childList:true,subtree:true})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();</script>`;

function stripLegacyStatusUi(html){return String(html||'')
 .replace(/<style id="alyzia-status-model-test-css">[\s\S]*?<\/style>/g,'')
 .replace(/<script id="alyzia-status-model-test-js">[\s\S]*?<\/script>/g,'')
 .replace(/<style id="alyzia-v2-list-authoritative-css">[\s\S]*?<\/style>/g,'')
 .replace(/<script id="alyzia-v2-ui-consistency-js">[\s\S]*?<\/script>/g,'')
 .replace(/<script id="alyzia-flight-status-authoritative-js">[\s\S]*?<\/script>/g,'')
 .replace(/<script id="alyzia-flight-list-live-sync-js">[\s\S]*?<\/script>/g,'')
 .replace(/<script id="alyzia-flight-runtime-stability-js">[\s\S]*?<\/script>/g,'')
 .replace(/<script id="alyzia-active-card-ops-fix">[\s\S]*?<\/script>/g,'');}
function patch(html){let s=stripLegacyStatusUi(html);const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+UI+'\n'+s.slice(i):s+UI}

export default {
 async fetch(request,env,ctx){const r=await app.fetch(request,env,ctx);const type=String(r.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html'))return r;const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');return new Response(patch(await r.text()),{status:r.status,statusText:r.statusText,headers:h})},
 scheduled(controller,env,ctx){if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx)}
};
