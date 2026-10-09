// Liste des vols (accueil) : statuts en liste défilante à côté de la barre de recherche. Tous les statuts restent affichés, avec leur nombre de vols (grisé quand il n'y en a pas).
// Un seul statut à la fois : on touche un statut pour ne voir que ces vols, on le touche de nouveau (ou « TOUS ») pour tout revoir.
// Le nombre de chaque statut suit le terminal, la recherche, les favoris et la tranche horaire ; la liste affichée cumule le statut choisi avec ces filtres.
export const STATUS_FILTER_UI = String.raw`<style id="alyzia-status-filter-css">.alz-status-hidden{display:none!important}
.alz-search-row{display:flex;flex-wrap:nowrap;align-items:center;gap:10px;margin:0 0 12px}
.alz-search-row .home-flight-search{flex:0 0 clamp(190px,50%,360px)!important;min-width:190px!important;width:auto!important;max-width:360px;margin:0!important}
.alz-search-row .home-flight-search input{min-width:0;text-overflow:ellipsis}
.alz-status-filter{flex:1 1 0;min-width:0;display:flex;flex-wrap:nowrap;gap:8px;align-items:center;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:2px 2px 4px;scroll-snap-type:x proximity}
.alz-status-filter::-webkit-scrollbar{display:none}
.alz-sf-chip{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 13px;border:2px solid #d8e3ee;border-radius:999px;background:#fff;color:#28425f;font:900 11.5px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap;cursor:pointer;scroll-snap-align:start}
.alz-sf-chip b{font-size:11px;color:#6b7f95;font-weight:900}
.alz-sf-chip.active{border-color:#0b70d1;background:#0b70d1;color:#fff}.alz-sf-chip.active b{color:#dcebfb}
.alz-sf-chip.zero:not(.active){opacity:.5}
@media(max-width:800px){.alz-sf-chip{height:36px;padding:0 12px}}</style>
<script id="alyzia-status-filter-js">(function(){
if(window.__alyziaStatusFilter)return;window.__alyziaStatusFilter=true;
var KEYS=[['HEURE','À L’HEURE'],['EMBARQ','EMBARQUEMENT'],['RETARD','RETARDÉ'],['PARTI','PARTI'],['ENVOL','EN VOL'],['ATTERRI','ATTERRI'],['ARRIVE','ARRIVÉ'],['ANNULE','ANNULÉ']];
var STORE='alyziaStatusFilter',selected='';
try{selected=sessionStorage.getItem(STORE)||''}catch(e){}
function save(){try{selected?sessionStorage.setItem(STORE,selected):sessionStorage.removeItem(STORE)}catch(e){}}
function norm(t){return String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim()}
function keyOf(text){var t=norm(text);if(!t)return 'AUTRE';if(t.indexOf('EMBARQ')===0)return 'EMBARQ';if(t.indexOf('RETARD')===0)return 'RETARD';if(t.indexOf('ANNUL')===0)return 'ANNULE';if(t.indexOf('ARRIV')===0)return 'ARRIVE';if(t.indexOf('ATTERR')===0||t.indexOf('ATTERI')===0)return 'ATTERRI';if(t==='EN VOL')return 'ENVOL';if(t.indexOf('PARTI')===0)return 'PARTI';if(t.indexOf("A L'HEURE")===0||t==='PREVU'||t==='PROGRAMME')return 'HEURE';return 'AUTRE'}
function rows(){return Array.prototype.slice.call(document.querySelectorAll('#app .flight-home-row'))}
function rowKey(row){var b=row.querySelector('.ops-status-badge');return keyOf(b?b.textContent:'')}
function visibleWithoutUs(r){var had=r.classList.contains('alz-status-hidden');if(had)r.classList.remove('alz-status-hidden');var ok=getComputedStyle(r).display!=='none';if(had)r.classList.add('alz-status-hidden');return ok}
// Nombre de vols par statut dans la sélection affichée (terminal, recherche, favoris, tranche horaire), sans tenir compte du statut choisi.
function counts(){var c={};rows().forEach(function(r){if(r.classList.contains('ops-skip')||!visibleWithoutUs(r))return;var k=rowKey(r);c[k]=(c[k]||0)+1});return c}
function build(search){
  var wrap=search.parentNode&&search.parentNode.classList&&search.parentNode.classList.contains('alz-search-row')?search.parentNode:null;
  if(!wrap){wrap=document.createElement('div');wrap.className='alz-search-row';search.parentNode.insertBefore(wrap,search);wrap.appendChild(search)}
  var bar=document.createElement('div');bar.className='alz-status-filter';bar.setAttribute('role','tablist');bar.setAttribute('aria-label','Statut des vols');
  var html='<button type="button" role="tab" class="alz-sf-chip" data-k="*">TOUS <b>0</b></button>';
  KEYS.forEach(function(p){html+='<button type="button" role="tab" class="alz-sf-chip zero" data-k="'+p[0]+'">'+p[1]+' <b>0</b></button>'});
  bar.innerHTML=html;wrap.appendChild(bar);
  // La croix d'effacement de la recherche se repositionne selon la nouvelle largeur de la recherche.
  setTimeout(function(){try{window.dispatchEvent(new Event('resize'))}catch(e){}},0);
}
function sync(){
  var search=document.querySelector('#app .home-flight-search');if(!search)return;
  var bar=document.querySelector('#app .alz-status-filter');if(!bar){build(search);bar=document.querySelector('#app .alz-status-filter')}
  var c=counts(),total=0;Object.keys(c).forEach(function(k){total+=c[k]});
  Array.prototype.forEach.call(bar.querySelectorAll('.alz-sf-chip'),function(b){
    var k=b.getAttribute('data-k'),n=k==='*'?total:(c[k]||0),nb=b.querySelector('b'),on=k==='*'?!selected:selected===k;
    if(nb&&nb.textContent!==String(n))nb.textContent=n;
    b.classList.toggle('active',on);b.setAttribute('aria-selected',on?'true':'false');
    b.classList.toggle('zero',k!=='*'&&!n);
  });
  var visible=0;
  rows().forEach(function(r){var hide=!!selected&&rowKey(r)!==selected;r.classList.toggle('alz-status-hidden',hide);if(!hide&&getComputedStyle(r).display!=='none'&&!r.classList.contains('ops-skip'))visible++});
  var badge=document.getElementById('homeVisibleFlightCount');if(badge){var t=visible+' VOL'+(visible>1?'S':'');if(badge.textContent!==t)badge.textContent=t}
}
document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('.alz-sf-chip');if(!b)return;e.preventDefault();var k=b.getAttribute('data-k');selected=(k==='*'||selected===k)?'':k;save();sync();
  try{var on=document.querySelector('#app .alz-sf-chip.active');if(on&&on.scrollIntoView)on.scrollIntoView({inline:'nearest',block:'nearest',behavior:'smooth'})}catch(x){}});
var timer=null;function later(){clearTimeout(timer);timer=setTimeout(sync,60)}
document.addEventListener('input',function(e){if(e.target&&e.target.closest&&e.target.closest('.home-flight-search'))later()},true);
document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#app .terminal-filter-bar,#app .home-pin,#app .alyzia-time-filter-wrap,#app .alyzia-home-clear,#app .day-nav-btn'))setTimeout(later,0)},true);
try{new MutationObserver(later).observe(document.getElementById('app')||document.body,{childList:true,subtree:true})}catch(e){}
[0,300,900].forEach(function(ms){setTimeout(sync,ms)});
window.__alyziaStatusFilterKey=keyOf;
})();</script>`;
