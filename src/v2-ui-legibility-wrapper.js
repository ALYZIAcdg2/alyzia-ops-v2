import app from "./v2-ui-peau-neuve-wrapper.js";

const UI=String.raw`<style id="alyzia-v2-legibility-css">
/* V2 legibility pass — harmonise list cards and keep status compact. */

/* Shared typography */
.v2x-chip{font-size:10px!important;font-weight:950!important}
.v2x-airline,.v2x-route-city{font-size:10px!important}
.v2x-t small,.v2x-d-t small{font-size:9px!important;letter-spacing:.025em!important}
.v2x-status-main{font-size:14px!important}.v2x-status-sub{font-size:10px!important}.v2x-status-remain{font-size:9px!important}

/* Desktop */
@media(min-width:1201px){
 #app .flight-home-row.v2x-row{min-height:126px!important;padding:15px 16px!important}
 .v2x-flight{font-size:25px!important}.v2x-route-main{font-size:21px!important}
 .v2x-t b{font-size:17px!important}.v2x-loadline .v2x-chip{font-size:9px!important}
 .v2x-statusbox{min-height:72px!important;padding:10px 12px!important}
 .v2x-detail-head{padding:16px!important}
 .v2x-d-meta{font-size:10px!important}.v2x-d-flight{font-size:40px!important}.v2x-d-route{font-size:24px!important}
 .v2x-d-duration{font-size:12px!important}.v2x-d-title{font-size:12px!important}.v2x-d-t b{font-size:19px!important}
 .v2x-d-status{align-self:start!important;min-height:74px!important;padding:10px 12px!important}
 .v2x-d-status .v2x-status-main{font-size:16px!important}.v2x-d-status .v2x-status-sub{font-size:10px!important}.v2x-d-status .v2x-status-remain{font-size:9px!important}
}

/* Tablet */
@media(min-width:721px) and (max-width:1200px){
 #app .flight-home-row.v2x-row{padding:14px!important;gap:11px!important}
 .v2x-flight{font-size:23px!important}.v2x-airline{font-size:10px!important}.v2x-route-main{font-size:20px!important}.v2x-route-city{font-size:10px!important}
 .v2x-chip{font-size:9px!important}.v2x-loadline .v2x-chip{font-size:8.5px!important}
 .v2x-timegroup{min-height:76px!important;padding:10px 8px!important}.v2x-t small{font-size:8.5px!important}.v2x-t b{font-size:17px!important}
 .v2x-statusbox{min-height:72px!important;padding:9px 11px!important}.v2x-status-main{font-size:13px!important}.v2x-status-sub{font-size:9px!important}.v2x-status-remain{font-size:8px!important}
 .v2x-detail-head{grid-template-columns:minmax(245px,.95fr) 1.7fr!important;grid-template-areas:"did dstatus" "dtimes dtimes" "dactions dactions"!important;padding:14px!important}
 .v2x-d-meta{font-size:9px!important}.v2x-d-flight{font-size:35px!important}.v2x-d-route{font-size:22px!important}.v2x-d-duration{font-size:11px!important}
 .v2x-d-title{font-size:11px!important}.v2x-d-t small{font-size:8px!important}.v2x-d-t b{font-size:18px!important}
 .v2x-d-status{align-self:start!important;min-height:68px!important;padding:9px 11px!important}
 .v2x-d-status .v2x-status-main{font-size:14px!important}.v2x-d-status .v2x-status-sub{font-size:9px!important}.v2x-d-status .v2x-status-remain{font-size:8px!important}
 .v2x-act{font-size:9px!important;min-height:36px!important}
}

/* Mobile */
@media(max-width:720px){
 #app .flight-home-list{gap:10px!important}
 #app .flight-home-row.v2x-row{padding:13px 12px!important;gap:9px!important;border-radius:15px!important}
 .v2x-id{grid-template-columns:52px minmax(0,1fr)!important;padding-right:76px!important;gap:9px!important}
 .v2x-id-logo .airline-logo{width:52px!important;height:36px!important;max-width:52px!important}.v2x-id-logo .airline-logo-fallback{width:52px!important;height:36px!important}
 .v2x-flight{font-size:23px!important}.v2x-airline{font-size:9.5px!important;margin-top:4px!important}
 .v2x-plane{margin-top:6px!important;gap:5px!important}.v2x-chip{font-size:8.5px!important;min-height:23px!important;padding:4px 7px!important}
 .v2x-route-main{font-size:20px!important}.v2x-route-city{font-size:9px!important;margin-top:3px!important}
 .v2x-loadline{margin-top:7px!important;gap:5px!important}.v2x-loadline .v2x-chip{font-size:8px!important;padding:4px 5px!important;min-height:24px!important}
 .v2x-times{gap:7px!important}.v2x-timegroup{min-height:72px!important;padding:9px 6px!important;border-radius:12px!important}.v2x-t small{font-size:8px!important}.v2x-t b{font-size:17px!important;margin-top:5px!important}.v2x-day{font-size:8px!important}
 .v2x-statusbox{min-height:0!important;padding:7px 10px!important;border-radius:10px!important;display:grid!important;grid-template-columns:auto 1fr!important;column-gap:8px!important;row-gap:1px!important;align-items:center!important}
 .v2x-status-main{font-size:12.5px!important;white-space:nowrap!important}.v2x-status-sub{font-size:9px!important;margin:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.v2x-status-remain{grid-column:2!important;font-size:8px!important;margin:0!important}
 .v2x-pin,.v2x-open{width:35px!important;height:35px!important;min-height:35px!important;font-size:18px!important}

 /* Detail header: larger text, status becomes a thin operational strip instead of a large block. */
 .v2x-detail-head{grid-template-columns:1fr!important;grid-template-areas:"did" "dtimes" "dstatus" "dactions"!important;padding:12px!important;gap:9px!important;border-radius:15px!important}
 .v2x-d-id{padding:2px!important}.v2x-d-meta{font-size:8.5px!important}.v2x-d-flightline{margin-top:8px!important;gap:9px!important}.v2x-d-flightline .airline-logo{width:58px!important;height:38px!important;max-width:58px!important}.v2x-d-flight{font-size:33px!important}
 .v2x-d-route{font-size:22px!important;margin-top:10px!important}.v2x-d-infochips{margin-top:9px!important;gap:5px!important}.v2x-d-duration{font-size:10.5px!important;margin-top:9px!important}
 .v2x-d-times{grid-template-columns:1fr!important;gap:8px!important}.v2x-d-timecard{padding:10px 8px!important;border-radius:12px!important}.v2x-d-title{font-size:10.5px!important;margin-bottom:8px!important}.v2x-d-tgrid{gap:3px!important}.v2x-d-t small{font-size:7.5px!important}.v2x-d-t b{font-size:15.5px!important;margin-top:5px!important}
 .v2x-d-status{min-height:0!important;padding:7px 10px!important;border-radius:10px!important;display:grid!important;grid-template-columns:auto 1fr!important;column-gap:8px!important;row-gap:1px!important;align-items:center!important}
 .v2x-d-status .v2x-status-main{font-size:12.5px!important;white-space:nowrap!important}.v2x-d-status .v2x-status-sub{font-size:9px!important;margin:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.v2x-d-status .v2x-status-remain{grid-column:2!important;font-size:8px!important;margin:0!important}
 .v2x-d-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}.v2x-act{min-height:38px!important;font-size:8.5px!important;padding:7px!important}
}
</style>`;

function patch(html){let s=String(html||'').replace(/<style id="alyzia-v2-legibility-css">[\s\S]*?<\/style>/g,'');const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+UI+'\n'+s.slice(i):s+UI}

export default {
 async fetch(request,env,ctx){const r=await app.fetch(request,env,ctx);const type=String(r.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html'))return r;const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');return new Response(patch(await r.text()),{status:r.status,statusText:r.statusText,headers:h})},
 scheduled(controller,env,ctx){if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx)}
};
