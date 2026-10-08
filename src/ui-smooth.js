// Fluidité de la liste des vols.
// 1) Chargement : la barre de filtres (terminaux, ★, HORAIRES, recherche) est complétée par plusieurs scripts après le dessin de la liste. Au premier affichage de l'accueil
//    on garde donc tout masqué avec « CHARGEMENT DES VOLS… », puis on montre l'ensemble d'un coup (1,5 s au plus). Les rafraîchissements automatiques ne repassent pas par là.
// 2) Rafraîchissement : un rendu déclenché par la synchro automatique est différé tant que la liste est en train de défiler (doigt posé ou défilement dans les 700 dernières ms) ; ce rendu saccadait sur mobile et tablette.
export const UI_SMOOTH_UI=String.raw`<style id="alyzia-ui-smooth-css">
#app.alz-settling .home-page{visibility:hidden!important}
#app.alz-settling::before{content:"CHARGEMENT DES VOLS…";display:block;text-align:center;padding:90px 16px;font:900 14px/1 system-ui,-apple-system,sans-serif;letter-spacing:.08em;color:#536d87}
</style><script id="alyzia-ui-smooth-js">(()=>{'use strict';
if(window.__alyziaUiSmooth)return;window.__alyziaUiSmooth=true;
const app=()=>document.getElementById('app');
// --- 1) Chargement de l'accueil
let settling=false,settleTimer=null,t0=0;
const toolbarReady=()=>!!(document.querySelector('#app .alyzia-time-filter-btn')&&document.querySelector('#app .alyzia-home-clear'));
function settleEnd(){settling=false;clearTimeout(settleTimer);const a=app();if(a)a.classList.remove('alz-settling')}
function settleCheck(){if(!settling)return;if(toolbarReady()||Date.now()-t0>1500){settleEnd();return}settleTimer=setTimeout(settleCheck,40)}
function observe(){const a=app();if(!a)return setTimeout(observe,50);
 let had=!!a.querySelector('.home-page');
 const mo=new MutationObserver(()=>{const has=!!a.querySelector('.home-page');
  if(has&&!had&&!settling&&!toolbarReady()){settling=true;t0=Date.now();a.classList.add('alz-settling');settleCheck()}
  else if(!has&&settling)settleEnd();
  had=has});
 mo.observe(a,{childList:true});
 if(had&&!toolbarReady()){settling=true;t0=Date.now();a.classList.add('alz-settling');settleCheck()}}
observe();
// --- 2) Rendu différé pendant le défilement
let touching=false,lastScroll=0;
const mark=()=>{lastScroll=Date.now()};
window.addEventListener('touchstart',()=>{touching=true;mark()},{passive:true,capture:true});
['touchend','touchcancel'].forEach(t=>window.addEventListener(t,()=>{touching=false;mark()},{passive:true,capture:true}));
document.addEventListener('scroll',mark,{passive:true,capture:true});
window.addEventListener('wheel',mark,{passive:true,capture:true});
const busy=()=>touching||Date.now()-lastScroll<700;
function wrap(){const orig=window.renderCurrentViewPreserved;if(typeof orig!=='function'||orig.__alzSmooth)return false;
 let pending=null;
 const w=function(){const self=this,args=arguments;
  if(!busy())return orig.apply(self,args);
  if(pending)return;const t1=Date.now();
  const tick=()=>{if(busy()&&Date.now()-t1<20000){pending=setTimeout(tick,250);return}pending=null;orig.apply(self,args)};
  pending=setTimeout(tick,250)};
 w.__alzSmooth=true;window.renderCurrentViewPreserved=w;return true}
if(!wrap()){let n=0;const iv=setInterval(()=>{if(wrap()||++n>40)clearInterval(iv)},250)}
})();</script>`;
