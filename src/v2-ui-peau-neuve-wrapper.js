import app from "./v2-ui-consistency-wrapper.js";

const FIX=String.raw`<script id="alyzia-v2-peau-neuve-fix">(()=>{'use strict';
if(window.__alyziaPeauNeuveFix)return;window.__alyziaPeauNeuveFix=true;
const up=v=>String(v??'').trim().toUpperCase();
const sum=o=>Object.values(o||{}).reduce((a,v)=>a+(Number(v)||0),0);
const rank=k=>({F:1,J:2,C:2,S:3,W:3,Y:9,M:9})[up(k)]||5;
function localFlights(){try{return typeof FLIGHTS!=='undefined'&&Array.isArray(FLIGHTS)?FLIGHTS:[]}catch{return[]}}
function rowIndex(row){const m=String(row.getAttribute('onclick')||'').match(/openFlightFromHomeList\((\d+)\)/);return m?Number(m[1]):-1}
function classes(x){return [...new Set([...Object.keys(x?.config||{}),...Object.keys(x?.booked||{})])].sort((a,b)=>rank(a)-rank(b)||String(a).localeCompare(String(b)))}
function repairRow(row){const idx=rowIndex(row),list=localFlights(),x=idx>=0?list[idx]:null;if(idx<0)return;
 const pin=row.querySelector('.v2x-pin'),open=row.querySelector('.v2x-open');
 if(pin&&!pin.dataset.v2xFixed){pin.dataset.v2xFixed='1';pin.onclick=e=>{e.stopPropagation();try{if(typeof toggleFavoriteFlight==='function')toggleFavoriteFlight(idx)}catch{}}}
 if(open&&!open.dataset.v2xFixed){open.dataset.v2xFixed='1';open.onclick=e=>{e.stopPropagation();try{if(typeof openFlightFromHomeList==='function')openFlightFromHomeList(idx)}catch{}}}
 if(!x)return;
 const chips=row.querySelectorAll('.v2x-loadline .v2x-chip'),ks=classes(x),nok=(x.inopSeats||[]).filter(r=>up(r?.status)==='NOK').length;
 const cfg=ks.map(k=>k+Number(x.config?.[k]||0)).join(' · ')||'—',book=ks.map(k=>k+Number(x.booked?.[k]||0)).join(' · ')||'—';
 const avail=Number.isFinite(Number(x.available))?Number(x.available):sum(x.config)-sum(x.booked)-nok;
 if(chips[0])chips[0].textContent='CONFIG '+cfg;if(chips[1])chips[1].textContent='BOOK '+book;if(chips[2])chips[2].textContent='AVAILABLE '+(Number.isFinite(avail)?avail:'—');
}
function repair(){document.querySelectorAll('#app .flight-home-row.v2x-row').forEach(repairRow)}
let q=false;function queue(){if(q)return;q=true;requestAnimationFrame(()=>{q=false;repair()})}
function start(){repair();setInterval(repair,2500);const root=document.getElementById('app');if(root)new MutationObserver(queue).observe(root,{childList:true,subtree:true})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();</script>`;

function patch(html){let s=String(html||'').replace(/<script id="alyzia-v2-peau-neuve-fix">[\s\S]*?<\/script>/g,'');const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+FIX+'\n'+s.slice(i):s+FIX}

export default {
 async fetch(request,env,ctx){const r=await app.fetch(request,env,ctx);const type=String(r.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html'))return r;const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');return new Response(patch(await r.text()),{status:r.status,statusText:r.statusText,headers:h})},
 scheduled(controller,env,ctx){if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx)}
};
