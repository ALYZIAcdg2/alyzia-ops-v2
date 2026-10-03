import app from "./v2-etd-public-wrapper.js";

const UI=String.raw`<script id="alyzia-v2-ui-consistency-js">(()=>{'use strict';
if(window.__alyziaV2UiConsistency)return;window.__alyziaV2UiConsistency=true;
const txt=v=>String(v??'').trim(),up=v=>txt(v).toUpperCase();
let live=[];
const keyFlight=x=>up(x?.flight||x?.flight_number||x?.designator||'');
const statusLabel=x=>{
 const s=up(x?.status||'');
 if(s!=='EN VOL')return txt(x?.status)||'';
 const t=Date.parse(txt(x?.statusArrivalUtc));
 if(!t)return 'EN VOL';
 const n=Math.max(0,Math.ceil((t-Date.now())/60000));
 return 'EN VOL · RESTE '+String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
};
const statusClass=s=>{s=up(s);if(s.startsWith('ARRIVÉ'))return'arrive';if(s.startsWith('ATTERRI'))return'decolle';if(s.startsWith('EN VOL'))return'envol';if(s==='PARTI')return'decolle';if(s.includes('RETARD'))return'retarde';if(s.includes('EMBAR'))return'embarquement';return'alheure'};
function rowFlight(row){
 const direct=up(row.querySelector('.home-flight')?.textContent);if(direct)return direct;
 const m=up(row.textContent).match(/\b([A-Z0-9]{2,3}\d{2,4})\b/);return m?m[1]:'';
}
function flightForRow(row){const f=rowFlight(row);if(!f)return null;return live.find(x=>keyFlight(x)===f)||null}
function candidateBadges(row){
 const nodes=[...row.querySelectorAll('.v2-status,.flight-status,.home-status,[class*="status"]')];
 if(nodes.length)return nodes;
 return [...row.querySelectorAll('span,div')].filter(n=>n.children.length===0&&/^(PARTI|EN VOL(?:\s*·\s*RESTE\s*\d{2}:\d{2})?|ARRIVÉ|ATTERRI|RETARDÉ|EMBARQUEMENT(?: CLOS)?|À L['’]HEURE)$/i.test(txt(n.textContent)));
}
function syncList(){
 for(const row of document.querySelectorAll('#app .flight-home-row')){
  const x=flightForRow(row);if(!x)continue;const label=statusLabel(x);if(!label)continue;
  for(const b of candidateBadges(row)){if(!/status/i.test(String(b.className))&&!/^(PARTI|EN VOL|ARRIVÉ|ATTERRI|RETARDÉ|EMBARQUEMENT|À L['’]HEURE)/i.test(txt(b.textContent)))continue;b.textContent=label;if(b.classList.contains('v2-status'))b.className='v2-status '+statusClass(label)}
 }
}
function currentFlight(){
 try{if(typeof FLIGHTS!=='undefined'&&Array.isArray(FLIGHTS)&&typeof selected!=='undefined'&&FLIGHTS[selected]){const f=keyFlight(FLIGHTS[selected]);return live.find(x=>keyFlight(x)===f)||FLIGHTS[selected]}}catch{}
 return null;
}
function terminalOf(x){
 try{const v=window.__alyziaTerminalOf?.(x);if(v)return up(v).startsWith('T')?up(v):'T'+up(v)}catch{}
 const raw=txt(x?.terminal||x?.departureTerminal||x?.departure_terminal||x?.terminalOrigin||x?.originTerminal||'');if(!raw)return'';
 const s=up(raw).replace(/^TERMINAL\s*/,'').replace(/^TERM\s*/,'');return s.startsWith('T')?s:'T'+s;
}
function syncDetail(){
 const head=document.querySelector('#app .flight-head'),x=currentFlight();if(!head||!x)return;
 const label=statusLabel(x);const badge=head.querySelector('.flight-detail-status-wrap .v2-status')||head.querySelector('.v2-status');if(badge&&label){badge.textContent=label;badge.className='v2-status '+statusClass(label)}
 const term=terminalOf(x);if(!term)return;
 let wrap=head.querySelector('.flight-detail-status-wrap');if(!wrap){const anchor=head.querySelector('.fh-id')||head.querySelector('.flight-id-with-logo')?.parentElement||head.firstElementChild;if(!anchor)return;wrap=document.createElement('div');wrap.className='flight-detail-status-wrap';anchor.appendChild(wrap)}
 let chip=wrap.querySelector('.flight-detail-terminal');if(!chip){chip=document.createElement('span');chip.className='flight-detail-terminal';wrap.insertBefore(chip,wrap.firstChild)}chip.className='flight-detail-terminal term-'+term.toLowerCase();chip.textContent='TERM '+term;
}
function dedupeHome(){
 const app=document.getElementById('app');if(!app)return;
 const pages=[...app.querySelectorAll('.home-page')].filter(p=>p.querySelector('.flight-home-list'));
 if(pages.length>1){const keep=pages[pages.length-1];for(const p of pages)if(p!==keep)p.remove();return}
 for(const host of app.querySelectorAll('.home-table-scroll')){const lists=[...host.querySelectorAll(':scope > .flight-home-list')];if(lists.length>1){const keep=lists[lists.length-1];for(const l of lists)if(l!==keep)l.remove()}}
}
function apply(){dedupeHome();syncList();syncDetail()}
async function refresh(){try{const r=await fetch('/api/flights',{cache:'no-store'});if(!r.ok)return;const j=await r.json();live=Array.isArray(j)?j:Array.isArray(j?.flights)?j.flights:Array.isArray(j?.items)?j.items:[];apply()}catch{}}
let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
function start(){refresh();setInterval(refresh,15000);setInterval(apply,5000);const app=document.getElementById('app');if(app)new MutationObserver(queue).observe(app,{childList:true,subtree:true,characterData:true})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();</script>`;

function patch(html){const s=String(html||'');if(s.includes('id="alyzia-v2-ui-consistency-js"'))return s;const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+UI+'\n'+s.slice(i):s+UI}

export default {
 async fetch(request,env,ctx){const r=await app.fetch(request,env,ctx);const type=String(r.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html'))return r;const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');return new Response(patch(await r.text()),{status:r.status,statusText:r.statusText,headers:h})},
 scheduled(controller,env,ctx){if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx)}
};
