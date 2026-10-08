// Garde l'onglet courant (VOLS / RECHERCHE / PRÉPA / OUTILS / ADMIN) quand la page est rechargée : sans ça, chaque rechargement retombait sur VOLS.
// Seuls les clics sur les boutons de navigation (barre du haut et barre mobile) mémorisent l'onglet : les rafraîchissements automatiques ne le modifient pas.
// Mémoire par onglet de navigateur (sessionStorage) : un nouvel onglet ou une nouvelle session démarre sur VOLS.
export const TAB_MEMORY_UI=String.raw`<style id="alyzia-tab-memory-css">html.alz-tabwait #app{visibility:hidden!important}html.alz-tabwait body::after{content:"CHARGEMENT…";position:fixed;left:0;right:0;top:42%;text-align:center;font:900 14px/1 system-ui,-apple-system,sans-serif;letter-spacing:.08em;color:#536d87;z-index:5}</style><script id="alyzia-tab-memory-js">(()=>{'use strict';
if(window.__alyziaTabMemory)return;window.__alyziaTabMemory=true;
const KEY='alyziaTab',OPEN={search:'openFlightSearch',prepa:'renderPrepa',tools:'renderTools',admin:'renderAdminDashboard'};
const get=()=>{try{return sessionStorage.getItem(KEY)||''}catch{return ''}},set=v=>{try{v&&v!=='home'?sessionStorage.setItem(KEY,v):sessionStorage.removeItem(KEY)}catch{}};
function tabOf(b){if(!b)return '';const m=b.dataset?.mobileNav;if(m)return m;const on=String(b.getAttribute('onclick')||''),t=(b.textContent||'').trim().toUpperCase();
 if(/renderHome/.test(on)||t==='VOLS')return 'home';if(/openFlightSearch/.test(on)||t==='RECHERCHE')return 'search';if(/renderPrepa/.test(on)||t==='PRÉPA')return 'prepa';if(/renderTools/.test(on)||t==='OUTILS')return 'tools';if(/renderAdminDashboard/.test(on)||t==='ADMIN')return 'admin';return ''}
let userActed=false;const note=e=>{const b=e.target?.closest?.('header .nav button,.mobile-bottom-nav button');if(!b)return;const k=tabOf(b);if(k){userActed=true;set(k)}};
// pointerdown/touchstart/click en phase de capture : d'autres scripts arrêtent la propagation du clic, pas du pointeur.
['pointerdown','touchstart','mousedown','click'].forEach(t=>window.addEventListener(t,note,true));
// Restauration : dès que la fonction de l'onglet existe (sans attendre le dessin de la liste des vols). Pendant ce temps l'écran reste sur « CHARGEMENT… » :
// la liste des vols n'apparaît plus quelques secondes avant l'onglet. L'écran est libéré 800 ms après la dernière restauration (6 s au plus).
const want=get(),root=document.documentElement;
const release=()=>root.classList.remove('alz-tabwait');
function guard(fn,hold){const app=document.getElementById('app');if(!app)return release();let n=0,timer=null;const t0=Date.now();
 const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{mo.disconnect();hold&&release()},800)};
 const mo=new MutationObserver(()=>{if(userActed||n>=3||Date.now()-t0>15000){mo.disconnect();release();return}
  if(app.querySelector('.flight-home-row,.home-page')&&get()===want){n++;try{fn()}catch{}arm()}});mo.observe(app,{childList:true});arm()}
if(want&&OPEN[want]){root.classList.add('alz-tabwait');setTimeout(release,6000);
 let tries=0,done=false;const go=()=>{if(done)return;tries++;const fn=window[OPEN[want]];
  if(typeof fn==='function'&&document.getElementById('app')){done=true;try{fn()}catch(err){console.error('restauration onglet',err)}guard(fn,true);return}
  if(tries<120)setTimeout(go,50);else release()};go()}
})();</script>`;
