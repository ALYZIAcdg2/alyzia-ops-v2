import app from "./v2-etd-public-wrapper.js";

const UI=String.raw`<style id="alyzia-v2-list-authoritative-css">
#app .alyzia-list-status{display:inline-flex!important;align-items:center;justify-content:center;margin-top:6px;padding:7px 11px;border-radius:999px;font-size:12px;font-weight:950;line-height:1;white-space:nowrap;background:#eef3f8;color:#627086}
#app .alyzia-list-status.envol{background:#ddf7e9;color:#07824f}
#app .alyzia-list-status.arrive{background:#ddf7e9;color:#07824f}
#app .alyzia-list-status.decolle{background:#eef3f8;color:#607086}
#app .alyzia-list-status.retarde{background:#fff0d8;color:#a85d00}
#app .alyzia-list-status.embarquement{background:#e7f1ff;color:#075fd3}
#app .alyzia-list-status.alheure{background:#eef3f8;color:#607086}
</style><script id="alyzia-v2-ui-consistency-js">(()=>{'use strict';
if(window.__alyziaV2UiConsistency)return;window.__alyziaV2UiConsistency=true;
const txt=v=>String(v??'').trim(),up=v=>txt(v).toUpperCase();
let live=[];
const keyFlight=x=>up(x?.flight||x?.flight_number||x?.designator||'');
const statusLabel=x=>{
 const s=up(x?.status||'');
 if(!s)return'';
 if(s!=='EN VOL')return txt(x?.status)||'';
 const t=Date.parse(txt(x?.statusArrivalUtc));
 if(!t)return'EN VOL';
 const n=Math.max(0,Math.ceil((t-Date.now())/60000));
 return 'EN VOL · RESTE '+String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
};
const statusClass=s=>{s=up(s);if(s.startsWith('ARRIVÉ'))return'arrive';if(s.startsWith('ATTERRI'))return'decolle';if(s.startsWith('EN VOL'))return'envol';if(s==='PARTI')return'decolle';if(s.includes('RETARD'))return'retarde';if(s.includes('EMBAR'))return'embarquement';return'alheure'};
function rowFlight(row){const direct=up(row.querySelector('.home-flight')?.textContent);if(direct)return direct;const m=up(row.textContent).match(/\b([A-Z0-9]{2,3}\d{2,4})\b/);return m?m[1]:''}
function flightForRow(row){const f=rowFlight(row);if(!f)return null;return live.find(x=>keyFlight(x)===f)||null}
function ensureRowStatus(row){
 let b=row.querySelector('.alyzia-list-status');
 if(b)return b;
 for(const old of row.querySelectorAll('.v2-status,.flight-status,.home-status')){if(!old.closest('.flight-detail-status-wrap')){b=old;break}}
 if(!b){
   b=document.createElement('span');
   const host=row.querySelector('.home-flight-cell > div')||row.querySelector('.home-flight-cell')||row.querySelector('.home-flight')?.parentElement||row;
   host.appendChild(b);
 }
 b.classList.add('alyzia-list-status');
 return b;
}
function syncList(){
 const page=dedupeHome();if(!page)return;
 for(const row of page.querySelectorAll('.flight-home-row')){
  const x=flightForRow(row);if(!x)continue;const label=statusLabel(x);if(!label)continue;
  const b=ensureRowStatus(row);b.textContent=label;b.className='alyzia-list-status '+statusClass(label);
 }
}
function currentFlight(){try{if(typeof FLIGHTS!=='undefined'&&Array.isArray(FLIGHTS)&&typeof selected!=='undefined'&&FLIGHTS[selected]){const f=keyFlight(FLIGHTS[selected]);return live.find(x=>keyFlight(x)===f)||FLIGHTS[selected]}}catch{}return null}
function terminalOf(x){try{const v=window.__alyziaTerminalOf?.(x);if(v)return up(v).startsWith('T')?up(v):'T'+up(v)}catch{}const raw=txt(x?.terminal||x?.departureTerminal||x?.departure_terminal||x?.terminalOrigin||x?.originTerminal||'');if(!raw)return'';const s=up(raw).replace(/^TERMINAL\s*/,'').replace(/^TERM\s*/,'');return s.startsWith('T')?s:'T'+s}
function syncDetail(){
 const head=document.querySelector('#app .flight-head'),x=currentFlight();if(!head||!x)return;
 const label=statusLabel(x);let badge=head.querySelector('.flight-detail-status-wrap .v2-status')||head.querySelector('.v2-status');
 if(badge&&label){badge.textContent=label;badge.className='v2-status '+statusClass(label)}
 const term=terminalOf(x);if(!term)return;
 let wrap=head.querySelector('.flight-detail-status-wrap');if(!wrap){const anchor=head.querySelector('.fh-id')||head.querySelector('.flight-id-with-logo')?.parentElement||head.firstElementChild;if(!anchor)return;wrap=document.createElement('div');wrap.className='flight-detail-status-wrap';anchor.appendChild(wrap)}
 let chip=wrap.querySelector('.flight-detail-terminal');if(!chip){chip=document.createElement('span');chip.className='flight-detail-terminal';wrap.insertBefore(chip,wrap.firstChild)}chip.className='flight-detail-terminal term-'+term.toLowerCase();chip.textContent='TERM '+term;
}
function dedupeHome(){
 const app=document.getElementById('app');if(!app)return null;
 let pages=[...app.querySelectorAll('.home-page')].filter(p=>p.querySelector('.flight-home-list'));
 if(!pages.length)return null;
 const visible=pages.filter(p=>getComputedStyle(p).display!=='none');
 const ranked=(visible.length?visible:pages).sort((a,b)=>b.querySelectorAll('.flight-home-row').length-a.querySelectorAll('.flight-home-row').length);
 const keep=ranked[0];keep.dataset.alyziaV2List='primary';
 for(const p of pages)if(p!==keep)p.remove();
 const hosts=[...keep.querySelectorAll('.home-table-scroll')];
 for(const host of hosts){const lists=[...host.querySelectorAll(':scope > .flight-home-list')];if(lists.length>1){const best=[...lists].sort((a,b)=>b.querySelectorAll('.flight-home-row').length-a.querySelectorAll('.flight-home-row').length)[0];for(const l of lists)if(l!==best)l.remove()}}
 return keep;
}
function apply(){dedupeHome();syncList();syncDetail()}
async function refresh(){try{const r=await fetch('/api/flights',{cache:'no-store'});if(!r.ok)return;const j=await r.json();live=Array.isArray(j)?j:Array.isArray(j?.flights)?j.flights:Array.isArray(j?.items)?j.items:[];apply()}catch{}}
let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
function start(){refresh();setInterval(refresh,15000);setInterval(apply,3000);const app=document.getElementById('app');if(app)new MutationObserver(queue).observe(app,{childList:true,subtree:true})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();</script>`;

function patch(html){const s=String(html||'');if(s.includes('id="alyzia-v2-ui-consistency-js"'))return s;const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+UI+'\n'+s.slice(i):s+UI}

export default {
 async fetch(request,env,ctx){const r=await app.fetch(request,env,ctx);const type=String(r.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html'))return r;const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');return new Response(patch(await r.text()),{status:r.status,statusText:r.statusText,headers:h})},
 scheduled(controller,env,ctx){if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx)}
};
