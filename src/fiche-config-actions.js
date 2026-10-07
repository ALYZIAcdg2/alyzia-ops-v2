// SEATMAP et SEAT INOP : ces deux boutons vivent dans le KPI « CONFIGURATION / CAPACITY » de la fiche vol (ils étaient dans la barre d'actions
// et dans la carte TYPE A/C). Le KPI est dessiné par l'application de base : les boutons sont ajoutés après coup et recréés à chaque rendu.
export const FICHE_CONFIG_UI=String.raw`<style id="alyzia-fiche-config-css">
#app .config-cap-kpi .cfg-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
#app .config-cap-kpi .cfg-actions button{flex:1 1 130px;min-height:40px;padding:9px 12px;font-size:11px;font-weight:950;letter-spacing:.3px;border-radius:10px;cursor:pointer;margin:0}
</style><script id="alyzia-fiche-config-js">(()=>{'use strict';
if(window.__alyziaFicheConfig)return;window.__alyziaFicheConfig=true;
let raf=0;
function nok(){try{const x=typeof f==='function'?f():null;return (x?.inopSeats||[]).filter(r=>r.status==='NOK').length}catch{return 0}}
function ensure(){document.querySelectorAll('#app .config-cap-kpi').forEach(k=>{
  const n=nok(),label='⚠ SEAT INOP'+(n?' · '+n:'');let row=k.querySelector('.cfg-actions');
  if(!row){row=document.createElement('div');row.className='cabin-actions-row cfg-actions';
   row.innerHTML='<button type="button" class="cabin-plan-open-btn cabin-seatmap-open-btn" onclick="openSeatmap()">▦ SEATMAP</button><button type="button" class="cabin-inop-open-btn" onclick="openInopSeat()"></button>';
   k.appendChild(row)}
  const b=row.querySelector('.cabin-inop-open-btn');if(b&&b.textContent!==label)b.textContent=label})}
function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;ensure()})}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});schedule();
})();</script>`;
