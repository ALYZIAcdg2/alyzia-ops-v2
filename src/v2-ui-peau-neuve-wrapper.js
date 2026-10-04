import app from "./v2-ui-consistency-wrapper.js";

const FIX=String.raw`<style id="alyzia-v2-peau-neuve-responsive-css">
/* Final responsive layer: it is intentionally loaded last so old V1/V2 rules cannot stretch the cards again. */
#app .flight-home-list{width:100%!important;min-width:0!important}
#app .flight-home-row{box-sizing:border-box!important;max-width:100%!important}

/* Desktop */
@media(min-width:1201px){
 #app .flight-home-row.v2x-row{grid-template-columns:minmax(190px,.9fr) minmax(145px,.72fr) minmax(410px,2.1fr) minmax(175px,.86fr) 78px!important;grid-template-areas:"identity route times status actions"!important;min-height:118px!important;height:auto!important;padding:13px 15px!important;gap:12px!important}
 .v2x-times{grid-template-columns:1fr 1fr!important}.v2x-timegroup{min-height:78px!important}
 .v2x-detail-head{grid-template-columns:minmax(250px,1.15fr) minmax(420px,2fr) minmax(190px,.82fr)!important;grid-template-areas:"did dtimes dstatus" "did dactions dactions"!important}
}

/* Tablet landscape / portrait */
@media(min-width:721px) and (max-width:1200px){
 #app .flight-home-row.v2x-row{position:relative!important;grid-template-columns:minmax(220px,.9fr) 1fr 150px!important;grid-template-areas:"identity route status" "times times status"!important;min-height:0!important;height:auto!important;padding:12px!important;gap:10px!important}
 .v2x-actions{position:absolute!important;right:10px!important;top:10px!important;z-index:3!important}.v2x-id{padding-right:74px!important}.v2x-flight{font-size:21px!important}.v2x-route-main{font-size:18px!important}
 .v2x-times{grid-template-columns:1fr 1fr!important;gap:8px!important}.v2x-timegroup{padding:9px!important}.v2x-t b{font-size:15px!important}.v2x-statusbox{min-height:94px!important;padding:10px!important}.v2x-status-main{font-size:12px!important}
 .v2x-loadline{margin-top:7px!important;gap:5px!important}.v2x-loadline .v2x-chip{font-size:7px!important}
 .v2x-detail-head{grid-template-columns:minmax(230px,.9fr) 1.7fr!important;grid-template-areas:"did dstatus" "dtimes dtimes" "dactions dactions"!important;padding:12px!important;gap:10px!important}.v2x-d-id{border-right:0!important}.v2x-d-times{grid-template-columns:1fr 1fr!important}.v2x-d-t b{font-size:16px!important}
}

/* Mobile */
@media(max-width:720px){
 body{overflow-x:hidden!important}
 .page,#app{max-width:100vw!important;overflow-x:hidden!important}
 #app .home-page{padding-left:0!important;padding-right:0!important}
 #app .flight-home-list{gap:8px!important}
 #app .flight-home-row.v2x-row{position:relative!important;display:grid!important;grid-template-columns:1fr!important;grid-template-areas:"identity" "route" "times" "status"!important;min-height:0!important;height:auto!important;padding:11px 10px!important;gap:8px!important;border-radius:14px!important;overflow:hidden!important;align-content:start!important}
 .v2x-id{grid-template-columns:46px minmax(0,1fr)!important;gap:8px!important;padding-right:78px!important;align-items:center!important}.v2x-id-logo .airline-logo{width:46px!important;height:32px!important;max-width:46px!important}.v2x-id-logo .airline-logo-fallback{width:46px!important;height:32px!important}.v2x-flight{font-size:20px!important}.v2x-airline{font-size:8px!important}.v2x-plane{margin-top:5px!important;gap:4px!important}.v2x-chip{min-height:21px!important;padding:3px 6px!important;font-size:7px!important}
 .v2x-actions{position:absolute!important;top:10px!important;right:9px!important;display:flex!important;gap:5px!important}.v2x-pin,.v2x-open{width:33px!important;height:33px!important;min-height:33px!important;border-radius:9px!important;font-size:17px!important}
 .v2x-route{padding-top:1px!important}.v2x-route-main{font-size:18px!important}.v2x-route-city{font-size:8px!important;margin-top:3px!important}.v2x-loadline{margin-top:6px!important;gap:4px!important;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important}.v2x-loadline .v2x-chip{display:flex!important;justify-content:center!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:6.5px!important;padding:3px 4px!important}
 .v2x-times{display:grid!important;grid-template-columns:1fr!important;gap:6px!important}.v2x-timegroup{grid-template-columns:repeat(3,minmax(0,1fr))!important;padding:8px 5px!important;gap:2px!important;border-radius:11px!important;min-height:67px!important}.v2x-t small{font-size:7px!important}.v2x-t b{font-size:15px!important;margin-top:4px!important}.v2x-day{font-size:7px!important}
 .v2x-statusbox{min-height:0!important;padding:8px 10px!important;border-radius:11px!important}.v2x-status-main{font-size:11px!important}.v2x-status-sub{font-size:8px!important;margin-top:2px!important}.v2x-status-remain{font-size:7px!important;margin-top:2px!important}

 /* If an old renderer briefly redraws a legacy row between refreshes, keep it compact instead of the giant card seen on iPhone. */
 #app .flight-home-row:not(.v2x-row){min-height:0!important;height:auto!important;max-height:none!important;padding:10px!important;gap:7px!important;border-radius:13px!important;align-content:start!important;overflow:hidden!important}
 #app .flight-home-row:not(.v2x-row) *{max-width:100%!important}
 #app .flight-home-row:not(.v2x-row) .home-flight-cell .airline-logo{width:44px!important;height:30px!important;max-width:44px!important}
 #app .flight-home-row:not(.v2x-row) .home-flight{font-size:18px!important}.flight-home-row:not(.v2x-row) .home-route{font-size:15px!important}.flight-home-row:not(.v2x-row) .home-time{font-size:15px!important}

 .v2x-detail-head{display:grid!important;grid-template-columns:1fr!important;grid-template-areas:"did" "dstatus" "dtimes" "dactions"!important;padding:10px!important;gap:8px!important;border-radius:14px!important}.v2x-d-id{border-right:0!important;padding:1px!important}.v2x-d-meta{font-size:7px!important}.v2x-d-flightline{margin-top:7px!important;gap:8px!important}.v2x-d-flightline .airline-logo{width:52px!important;height:34px!important;max-width:52px!important}.v2x-d-flight{font-size:28px!important}.v2x-d-route{font-size:19px!important;margin-top:9px!important}.v2x-d-infochips{margin-top:8px!important;gap:4px!important}.v2x-d-duration{margin-top:8px!important;font-size:9px!important}
 .v2x-d-status{padding:9px 10px!important;border-radius:11px!important}.v2x-d-status .v2x-status-main{font-size:13px!important}.v2x-d-status .v2x-status-sub{font-size:8px!important}.v2x-d-status .v2x-status-remain{font-size:7px!important}
 .v2x-d-times{grid-template-columns:1fr!important;gap:7px!important}.v2x-d-timecard{padding:9px 7px!important;border-radius:11px!important}.v2x-d-title{font-size:9px!important;margin-bottom:7px!important}.v2x-d-tgrid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:2px!important}.v2x-d-t small{font-size:6.5px!important}.v2x-d-t b{font-size:13px!important;margin-top:4px!important}
 .v2x-d-actions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;justify-content:stretch!important}.v2x-act{width:100%!important;min-height:34px!important;padding:6px!important;font-size:7.5px!important}.v2x-act.back{margin-right:0!important;grid-column:1/-1!important}
}
</style><script id="alyzia-v2-peau-neuve-fix">(()=>{'use strict';
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
function start(){repair();setInterval(repair,1200);const root=document.getElementById('app');if(root)new MutationObserver(queue).observe(root,{childList:true,subtree:true})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();</script>`;

function patch(html){let s=String(html||'').replace(/<style id="alyzia-v2-peau-neuve-responsive-css">[\s\S]*?<\/style>/g,'').replace(/<script id="alyzia-v2-peau-neuve-fix">[\s\S]*?<\/script>/g,'');const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+FIX+'\n'+s.slice(i):s+FIX}

export default {
 async fetch(request,env,ctx){const r=await app.fetch(request,env,ctx);const type=String(r.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html'))return r;const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');return new Response(patch(await r.text()),{status:r.status,statusText:r.statusText,headers:h})},
 scheduled(controller,env,ctx){if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx)}
};
