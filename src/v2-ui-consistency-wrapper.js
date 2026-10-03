import app from "./v2-etd-public-wrapper.js";

const UI=String.raw`<script id="alyzia-v2-ui-consistency-js">(()=>{'use strict';
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
const statusClass=s=>{s=up(s);if(s.startsWith('ARRIVÉ'))return'arrive';if(s.startsWith('ATTERRI'))return'decolle';if(s.startsWith('EN VOL'))return'envol';if(s==='PARTI')return'decolle';if(s.includes('RETARD'))return'retarde';if(s.includes('EMBAR'))return'embarquement';return'alheure'};
function rowFlight(row){const direct=up(row.querySelector('.home-flight')?.textContent);if(direct)return direct;const m=up(row.textContent).match(/\b([A-Z0-9]{2,3}\d{2,4})\b/);return m?m[1]:''}
function flightForRow(row){const f=rowFlight(row);return f?live.find(x=>keyFlight(x)===f)||null:null}
function listBadge(row){
 const legacy=[...row.querySelectorAll('.alyzia-list-status')];for(const n of legacy)n.remove();
 const badges=[...row.querySelectorAll('.v2-status,.flight-status,.home-status,[class*="status"]')].filter(n=>!n.closest('.flight-detail-status-wrap'));
 if(!badges.length)return null;
 const keep=badges.find(n=>n.classList.contains('v2-status'))||badges[0];
 for(const n of badges)if(n!==keep&&/^(PARTI|EN VOL|ARRIVÉ|ATTERRI|RETARDÉ|EMBARQUEMENT|À L['’]HEURE)/i.test(txt(n.textContent)))n.remove();
 return keep;
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
function syncList(){const page=dedupeHome();if(!page)return;for(const row of page.querySelectorAll('.flight-home-row')){const x=flightForRow(row);if(!x)continue;const b=listBadge(row),label=statusLabel(x);if(!b||!label)continue;b.textContent=label;if(b.classList.contains('v2-status'))b.className='v2-status '+statusClass(label)}}
function currentFlight(){try{if(typeof FLIGHTS!=='undefined'&&Array.isArray(FLIGHTS)&&typeof selected!=='undefined'&&FLIGHTS[selected]){const f=keyFlight(FLIGHTS[selected]);return live.find(x=>keyFlight(x)===f)||FLIGHTS[selected]}}catch{}return null}
function syncDetail(){const head=document.querySelector('#app .flight-head'),x=currentFlight();if(!head||!x)return;const label=statusLabel(x),b=head.querySelector('.flight-detail-status-wrap .v2-status')||head.querySelector('.v2-status');if(b&&label){b.textContent=label;b.className='v2-status '+statusClass(label)}}
function apply(){dedupeHome();syncList();syncDetail()}
async function refresh(){try{const r=await fetch('/api/flights',{cache:'no-store'});if(!r.ok)return;const j=await r.json();live=Array.isArray(j)?j:Array.isArray(j?.flights)?j.flights:Array.isArray(j?.items)?j.items:[];apply()}catch{}}
let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
function start(){refresh();setInterval(refresh,15000);setInterval(apply,3000);const app=document.getElementById('app');if(app)new MutationObserver(queue).observe(app,{childList:true,subtree:true})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();</script>`;

function patch(html){const s=String(html||'').replace(/<style id="alyzia-v2-list-authoritative-css">[\s\S]*?<\/style>/g,'');if(s.includes('id="alyzia-v2-ui-consistency-js"'))return s;const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+UI+'\n'+s.slice(i):s+UI}

export default {
 async fetch(request,env,ctx){const r=await app.fetch(request,env,ctx);const type=String(r.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html'))return r;const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');return new Response(patch(await r.text()),{status:r.status,statusText:r.statusText,headers:h})},
 scheduled(controller,env,ctx){if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx)}
};
