import app from "./v2-ui-consistency-wrapper.js";

const FIX=String.raw`<style id="alyzia-v2-peau-neuve-responsive-css">
/* Final responsive layer: it is intentionally loaded last so old V1/V2 rules cannot stretch the cards again. */
#app .flight-home-list{width:100%!important;min-width:0!important}
#app .flight-home-row{box-sizing:border-box!important;max-width:100%!important}

/* Desktop */
@media(min-width:1201px){
 #app .flight-home-row.v2x-row{grid-template-columns:minmax(200px,.95fr) minmax(155px,.75fr) minmax(430px,2.15fr) minmax(165px,.78fr) 78px!important;grid-template-areas:"identity route times status actions"!important;min-height:118px!important;height:auto!important;padding:14px 16px!important;gap:13px!important}
 .v2x-flight{font-size:25px!important}.v2x-airline{font-size:10px!important}.v2x-route-main{font-size:21px!important}.v2x-route-city{font-size:10px!important}
 .v2x-chip{font-size:9.5px!important}.v2x-loadline .v2x-chip{font-size:8.5px!important}.v2x-t small{font-size:8.5px!important}.v2x-t b{font-size:17px!important}
 .v2x-statusbox{min-height:76px!important;padding:10px 12px!important}.v2x-status-main{font-size:13.5px!important}.v2x-status-sub{font-size:9.5px!important}.v2x-status-remain{font-size:8.5px!important}
 .v2x-times{grid-template-columns:1fr 1fr!important}.v2x-timegroup{min-height:78px!important}
 .v2x-detail-head{grid-template-columns:minmax(265px,1.2fr) minmax(445px,2fr) minmax(170px,.72fr)!important;grid-template-areas:"did dtimes dstatus" "did dactions dactions"!important;gap:11px 14px!important;padding:14px!important}
 .v2x-d-flight{font-size:40px!important}.v2x-d-route{font-size:24px!important}.v2x-d-meta{font-size:9.5px!important}.v2x-d-duration{font-size:11.5px!important}
 .v2x-d-title{font-size:11.5px!important}.v2x-d-t small{font-size:8.5px!important}.v2x-d-t b{font-size:19px!important}.v2x-d-status{padding:11px 12px!important}.v2x-d-status .v2x-status-main{font-size:15px!important}.v2x-d-status .v2x-status-sub{font-size:9px!important}.v2x-d-status .v2x-status-remain{font-size:8px!important}
}

/* Tablet landscape / portrait */
@media(min-width:721px) and (max-width:1200px){
 #app .flight-home-row.v2x-row{position:relative!important;grid-template-columns:minmax(230px,.95fr) 1fr 150px!important;grid-template-areas:"identity route status" "times times status"!important;min-height:0!important;height:auto!important;padding:13px!important;gap:10px!important}
 .v2x-actions{position:absolute!important;right:10px!important;top:10px!important;z-index:3!important}.v2x-id{padding-right:74px!important}.v2x-flight{font-size:23px!important}.v2x-airline{font-size:9.5px!important}.v2x-route-main{font-size:19px!important}.v2x-route-city{font-size:9px!important}
 .v2x-chip{font-size:9px!important}.v2x-loadline{margin-top:7px!important;gap:5px!important}.v2x-loadline .v2x-chip{font-size:8px!important}
 .v2x-times{grid-template-columns:1fr 1fr!important;gap:8px!important}.v2x-timegroup{padding:10px!important}.v2x-t small{font-size:8.5px!important}.v2x-t b{font-size:17px!important}.v2x-statusbox{min-height:88px!important;padding:9px 10px!important}.v2x-status-main{font-size:12.5px!important}.v2x-status-sub{font-size:9px!important}.v2x-status-remain{font-size:8px!important}
 .v2x-detail-head{grid-template-columns:minmax(235px,.95fr) 1.7fr!important;grid-template-areas:"did dstatus" "dtimes dtimes" "dactions dactions"!important;padding:12px!important;gap:9px!important}.v2x-d-id{border-right:0!important}.v2x-d-times{grid-template-columns:1fr 1fr!important}.v2x-d-flight{font-size:34px!important}.v2x-d-route{font-size:22px!important}.v2x-d-meta{font-size:8.5px!important}.v2x-d-title{font-size:10.5px!important}.v2x-d-t small{font-size:8px!important}.v2x-d-t b{font-size:17px!important}
 .v2x-d-status{min-height:74px!important;padding:9px 10px!important}.v2x-d-status .v2x-status-main{font-size:14px!important}.v2x-d-status .v2x-status-sub{font-size:9px!important}.v2x-d-status .v2x-status-remain{font-size:8px!important}
}

/* Mobile */
@media(max-width:720px){
 body{overflow-x:hidden!important}
 .page,#app{max-width:100vw!important;overflow-x:hidden!important}
 #app .home-page{padding-left:0!important;padding-right:0!important}
 #app .flight-home-list{gap:9px!important}
 #app .flight-home-row.v2x-row{position:relative!important;display:grid!important;grid-template-columns:1fr!important;grid-template-areas:"identity" "route" "times" "status"!important;min-height:0!important;height:auto!important;padding:12px 11px!important;gap:9px!important;border-radius:14px!important;overflow:hidden!important;align-content:start!important}
 .v2x-id{grid-template-columns:50px minmax(0,1fr)!important;gap:9px!important;padding-right:78px!important;align-items:center!important}.v2x-id-logo .airline-logo{width:50px!important;height:35px!important;max-width:50px!important}.v2x-id-logo .airline-logo-fallback{width:50px!important;height:35px!important}.v2x-flight{font-size:24px!important;line-height:1.05!important}.v2x-airline{font-size:10px!important;line-height:1.2!important}.v2x-plane{margin-top:6px!important;gap:5px!important}.v2x-chip{min-height:24px!important;padding:4px 7px!important;font-size:9px!important}
 .v2x-actions{position:absolute!important;top:10px!important;right:9px!important;display:flex!important;gap:5px!important}.v2x-pin,.v2x-open{width:35px!important;height:35px!important;min-height:35px!important;border-radius:10px!important;font-size:18px!important}
 .v2x-route{padding-top:1px!important}.v2x-route-main{font-size:21px!important;line-height:1.05!important}.v2x-route-city{font-size:9.5px!important;margin-top:4px!important}.v2x-loadline{margin-top:7px!important;gap:5px!important;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important}.v2x-loadline .v2x-chip{display:flex!important;justify-content:center!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:8px!important;padding:4px 4px!important;min-height:24px!important}
 .v2x-times{display:grid!important;grid-template-columns:1fr!important;gap:7px!important}.v2x-timegroup{grid-template-columns:repeat(3,minmax(0,1fr))!important;padding:9px 6px!important;gap:3px!important;border-radius:11px!important;min-height:72px!important}.v2x-t small{font-size:8.5px!important}.v2x-t b{font-size:18px!important;margin-top:5px!important}.v2x-day{font-size:8px!important}
 .v2x-statusbox{min-height:0!important;padding:7px 9px!important;border-radius:10px!important;display:grid!important;grid-template-columns:auto 1fr!important;column-gap:8px!important;row-gap:1px!important;align-items:center!important}.v2x-status-main{font-size:12.5px!important;white-space:nowrap!important}.v2x-status-sub{font-size:9px!important;margin-top:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.v2x-status-remain{font-size:8px!important;margin-top:0!important;grid-column:2!important}

 /* If an old renderer briefly redraws a legacy row between refreshes, keep it compact instead of the giant card seen on iPhone. */
 #app .flight-home-row:not(.v2x-row){min-height:0!important;height:auto!important;max-height:none!important;padding:10px!important;gap:7px!important;border-radius:13px!important;align-content:start!important;overflow:hidden!important}
 #app .flight-home-row:not(.v2x-row) *{max-width:100%!important}
 #app .flight-home-row:not(.v2x-row) .home-flight-cell .airline-logo{width:46px!important;height:32px!important;max-width:46px!important}
 #app .flight-home-row:not(.v2x-row) .home-flight{font-size:20px!important}.flight-home-row:not(.v2x-row) .home-route{font-size:17px!important}.flight-home-row:not(.v2x-row) .home-time{font-size:17px!important}

 .v2x-detail-head{display:grid!important;grid-template-columns:1fr!important;grid-template-areas:"did" "dstatus" "dtimes" "dactions"!important;padding:11px!important;gap:8px!important;border-radius:14px!important}.v2x-d-id{border-right:0!important;padding:2px!important}.v2x-d-meta{font-size:8.5px!important}.v2x-d-flightline{margin-top:8px!important;gap:9px!important}.v2x-d-flightline .airline-logo{width:56px!important;height:36px!important;max-width:56px!important}.v2x-d-flight{font-size:33px!important}.v2x-d-route{font-size:22px!important;margin-top:10px!important}.v2x-d-infochips{margin-top:9px!important;gap:5px!important}.v2x-d-infochips .v2x-chip{font-size:9.5px!important;min-height:25px!important}.v2x-d-duration{margin-top:8px!important;font-size:10px!important}
 .v2x-d-status{padding:7px 9px!important;border-radius:10px!important;min-height:0!important;display:grid!important;grid-template-columns:auto 1fr!important;column-gap:8px!important;row-gap:1px!important;align-items:center!important}.v2x-d-status .v2x-status-main{font-size:13px!important;white-space:nowrap!important}.v2x-d-status .v2x-status-sub{font-size:9px!important;margin-top:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.v2x-d-status .v2x-status-remain{font-size:8px!important;margin-top:0!important;grid-column:2!important}
 .v2x-d-times{grid-template-columns:1fr!important;gap:7px!important}.v2x-d-timecard{padding:10px 8px!important;border-radius:11px!important}.v2x-d-title{font-size:10.5px!important;margin-bottom:8px!important}.v2x-d-tgrid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:3px!important}.v2x-d-t small{font-size:8px!important}.v2x-d-t b{font-size:16px!important;margin-top:5px!important}
 .v2x-d-actions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;justify-content:stretch!important}.v2x-act{width:100%!important;min-height:36px!important;padding:7px!important;font-size:8.5px!important}.v2x-act.back{display:none!important}
}

/* Global detail cleanup: no RETOUR LISTE button in the redesigned header. */
.v2x-act.back{display:none!important}
.v2x-d-actions{align-items:center!important}
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
function repair(){document.querySelectorAll('#app .flight-home-row.v2x-row').forEach(repairRow);document.querySelectorAll('#app .v2x-act.back').forEach(b=>b.remove())}
let q=false;function queue(){if(q)return;q=true;requestAnimationFrame(()=>{q=false;repair()})}
function start(){repair();setInterval(repair,1200);const root=document.getElementById('app');if(root)new MutationObserver(queue).observe(root,{childList:true,subtree:true})}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();</script>`;

function patch(html){let s=String(html||'').replace(/<style id="alyzia-v2-peau-neuve-responsive-css">[\s\S]*?<\/style>/g,'').replace(/<script id="alyzia-v2-peau-neuve-fix">[\s\S]*?<\/script>/g,'');const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+FIX+'\n'+s.slice(i):s+FIX}

export default {
 async fetch(request,env,ctx){const r=await app.fetch(request,env,ctx);const type=String(r.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html'))return r;const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');return new Response(patch(await r.text()),{status:r.status,statusText:r.statusText,headers:h})},
 scheduled(controller,env,ctx){if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx)}
};
