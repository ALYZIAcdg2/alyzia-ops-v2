import app from "./v2-ui-peau-neuve-wrapper.js";

const WIDE=String.raw`<style id="alyzia-v2-responsive-wide-css">
/* Responsive wide pass — mobile/tablet/desktop use available width without squeezing operational times. */
@media(max-width:720px){
  .page{padding-left:4px!important;padding-right:4px!important}
  #app,.home-page,.home-table-scroll,.flight-home-list{width:100%!important;max-width:100%!important;min-width:0!important}
  #app .flight-home-row.v2x-row{width:100%!important;margin:0!important;padding:10px 8px!important;gap:7px!important;border-radius:13px!important;grid-template-columns:1fr!important;grid-template-areas:"identity" "route" "times" "status"!important}
  .v2x-id{grid-template-columns:56px minmax(0,1fr)!important;gap:10px!important;padding-right:82px!important}
  .v2x-id-logo .airline-logo{width:56px!important;height:38px!important;max-width:56px!important}.v2x-id-logo .airline-logo-fallback{width:56px!important;height:38px!important}
  .v2x-flight{font-size:26px!important}.v2x-airline{font-size:10.5px!important}.v2x-route-main{font-size:22px!important}.v2x-route-city{font-size:10px!important}
  .v2x-plane{gap:5px!important;margin-top:6px!important}.v2x-chip{font-size:9.5px!important;min-height:25px!important;padding:4px 7px!important}
  .v2x-loadline{grid-template-columns:1fr 1fr 1fr!important;gap:5px!important;margin-top:7px!important}.v2x-loadline .v2x-chip{font-size:8.5px!important;min-height:25px!important;overflow:visible!important;text-overflow:clip!important}
  .v2x-times{grid-template-columns:1fr!important;gap:7px!important;width:100%!important}
  .v2x-timegroup{width:100%!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:0!important;padding:10px 4px!important;min-height:78px!important}
  .v2x-t{padding:0 6px!important;border-right:1px solid #d9e4ee}.v2x-t:last-child{border-right:0}
  .v2x-t small{font-size:9px!important}.v2x-t b{font-size:20px!important;margin-top:6px!important;letter-spacing:-.02em}
  .v2x-statusbox{width:100%!important;padding:7px 9px!important;min-height:42px!important;grid-template-columns:auto 1fr!important}.v2x-status-main{font-size:13px!important}.v2x-status-sub{font-size:9.5px!important}.v2x-status-remain{font-size:8.5px!important}
  .v2x-pin,.v2x-open{width:38px!important;height:38px!important;min-height:38px!important;font-size:20px!important}.v2x-actions{right:8px!important;top:8px!important}

  /* Legacy row fallback: remove the oversized empty shell while the modern renderer replaces it. */
  #app .flight-home-row:not(.v2x-row){width:100%!important;margin:0!important;min-height:0!important;height:auto!important;padding:9px 8px!important}
  #app .flight-home-row:not(.v2x-row) .home-flight{font-size:22px!important}
  #app .flight-home-row:not(.v2x-row) .home-route{font-size:19px!important}
  #app .flight-home-row:not(.v2x-row) .home-time{font-size:18px!important}

  .v2x-detail-head{width:100%!important;margin-left:0!important;margin-right:0!important;padding:9px 8px!important;gap:7px!important}
  .v2x-d-id{width:100%!important}.v2x-d-flight{font-size:35px!important}.v2x-d-route{font-size:23px!important}.v2x-d-meta{font-size:9px!important}
  .v2x-d-infochips .v2x-chip{font-size:10px!important;min-height:27px!important}
  .v2x-d-status{padding:6px 8px!important;min-height:40px!important}.v2x-d-status .v2x-status-main{font-size:13.5px!important}.v2x-d-status .v2x-status-sub{font-size:9.5px!important}.v2x-d-status .v2x-status-remain{font-size:8.5px!important}
  .v2x-d-times{grid-template-columns:1fr!important;gap:7px!important;width:100%!important}
  .v2x-d-timecard{width:100%!important;padding:10px 6px!important}.v2x-d-title{font-size:11px!important}
  .v2x-d-tgrid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:0!important}.v2x-d-t{padding:0 4px!important;border-right:1px solid #d9e4ee}.v2x-d-t:last-child{border-right:0}
  .v2x-d-t small{font-size:8.5px!important}.v2x-d-t b{font-size:17px!important;margin-top:6px!important;letter-spacing:-.02em}
  .v2x-d-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important}.v2x-act{font-size:9px!important;min-height:38px!important}
}

@media(min-width:721px) and (max-width:1200px){
  .page{padding-left:8px!important;padding-right:8px!important}
  #app .flight-home-row.v2x-row{width:100%!important;grid-template-columns:minmax(230px,.9fr) minmax(180px,.75fr) minmax(360px,1.65fr) minmax(145px,.6fr)!important;grid-template-areas:"identity route times status"!important;padding:13px 12px!important;gap:10px!important}
  .v2x-actions{right:10px!important;top:10px!important}.v2x-id{padding-right:76px!important}.v2x-times{grid-template-columns:1fr 1fr!important;gap:8px!important}.v2x-timegroup{min-height:82px!important;padding:10px 7px!important}.v2x-t small{font-size:9px!important}.v2x-t b{font-size:18px!important}.v2x-statusbox{min-height:82px!important}
  .v2x-detail-head{grid-template-columns:minmax(250px,.9fr) minmax(470px,1.8fr) minmax(150px,.58fr)!important;grid-template-areas:"did dtimes dstatus" "did dactions dactions"!important}.v2x-d-times{grid-template-columns:1fr 1fr!important}.v2x-d-t b{font-size:18px!important}
}

@media(min-width:1201px){
  .page{max-width:1800px!important}
  #app .flight-home-row.v2x-row{grid-template-columns:minmax(215px,.95fr) minmax(175px,.8fr) minmax(480px,2.25fr) minmax(175px,.72fr) 78px!important;gap:14px!important}
  .v2x-t b{font-size:18px!important}.v2x-timegroup{padding-left:12px!important;padding-right:12px!important}
  .v2x-detail-head{grid-template-columns:minmax(290px,1.15fr) minmax(520px,2.05fr) minmax(170px,.65fr)!important}.v2x-d-t b{font-size:20px!important}
}
</style>`;

function patch(html){let s=String(html||'').replace(/<style id="alyzia-v2-responsive-wide-css">[\s\S]*?<\/style>/g,'');const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+WIDE+'\n'+s.slice(i):s+WIDE}

export default {
  async fetch(request,env,ctx){const r=await app.fetch(request,env,ctx);const type=String(r.headers.get('content-type')||'').toLowerCase();if(!type.includes('text/html'))return r;const h=new Headers(r.headers);h.delete('content-length');h.set('cache-control','no-store');return new Response(patch(await r.text()),{status:r.status,statusText:r.statusText,headers:h})},
  scheduled(controller,env,ctx){if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx)}
};
