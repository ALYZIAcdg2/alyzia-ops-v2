// Garde l'onglet courant (VOLS / RECHERCHE / PRÉPA / OUTILS / ADMIN) quand la page est rechargée : sans ça, chaque rechargement retombait sur VOLS.
// Seuls les clics sur les boutons de navigation (barre du haut et barre mobile) mémorisent l'onglet : les rafraîchissements automatiques ne le modifient pas.
// Mémoire par onglet de navigateur (sessionStorage) : un nouvel onglet ou une nouvelle session démarre sur VOLS.
export const TAB_MEMORY_UI=String.raw`<script id="alyzia-tab-memory-js">(()=>{'use strict';
if(window.__alyziaTabMemory)return;window.__alyziaTabMemory=true;
const KEY='alyziaTab',OPEN={search:'openFlightSearch',prepa:'renderPrepa',tools:'renderTools',admin:'renderAdminDashboard'};
const get=()=>{try{return sessionStorage.getItem(KEY)||''}catch{return ''}},set=v=>{try{v&&v!=='home'?sessionStorage.setItem(KEY,v):sessionStorage.removeItem(KEY)}catch{}};
function tabOf(b){if(!b)return '';const m=b.dataset?.mobileNav;if(m)return m;const on=String(b.getAttribute('onclick')||''),t=(b.textContent||'').trim().toUpperCase();
 if(/renderHome/.test(on)||t==='VOLS')return 'home';if(/openFlightSearch/.test(on)||t==='RECHERCHE')return 'search';if(/renderPrepa/.test(on)||t==='PRÉPA')return 'prepa';if(/renderTools/.test(on)||t==='OUTILS')return 'tools';if(/renderAdminDashboard/.test(on)||t==='ADMIN')return 'admin';return ''}
let userActed=false;const note=e=>{const b=e.target?.closest?.('header .nav button,.mobile-bottom-nav button');if(!b)return;const k=tabOf(b);if(k){userActed=true;set(k)}};
// pointerdown/touchstart/click en phase de capture : d'autres scripts arrêtent la propagation du clic, pas du pointeur.
['pointerdown','touchstart','mousedown','click'].forEach(t=>window.addEventListener(t,note,true));
// Restauration : une seule fois, dès que l'application a dessiné la liste des vols et que la fonction de l'onglet existe.
const want=get();
// Un rendu tardif de l'accueil (fin du chargement des vols) ne doit pas écraser l'onglet restauré : on le remet, 3 fois max, tant que l'utilisateur n'a pas cliqué.
function guard(fn){const app=document.getElementById('app');if(!app)return;let n=0;const t0=Date.now();const mo=new MutationObserver(()=>{if(userActed||n>=3||Date.now()-t0>15000){mo.disconnect();return}
 if(app.querySelector('.flight-home-row,.home-page')&&get()===want){n++;setTimeout(()=>{if(!userActed)try{fn()}catch{}},50)}});mo.observe(app,{childList:true})}
if(want&&OPEN[want]){let tries=0,done=false;const go=()=>{if(done)return;tries++;
  const fn=window[OPEN[want]],ready=document.getElementById('app')&&(document.querySelector('#app .home-page,#app .flight-home-list,#app .flight-home-row')||tries>40);
  if(typeof fn==='function'&&ready){done=true;try{fn()}catch(err){console.error('restauration onglet',err)}guard(fn);return}
  if(tries<120)setTimeout(go,150)};setTimeout(go,300)}
})();</script>`;
