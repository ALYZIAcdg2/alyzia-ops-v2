// Liste des vols (accueil) : un seul bouton « STATUT » à côté de la barre de recherche. Il déroule sous la recherche un bandeau défilant (à faire glisser) de tous les statuts avec leur nombre de vols (grisé quand il n'y en a pas) ; on en choisit un.
// La recherche garde sa largeur. Le nombre de chaque statut suit le terminal, la recherche, les favoris et la tranche horaire ; la liste affichée cumule le statut choisi avec ces filtres.
export const STATUS_FILTER_UI = String.raw`<style id="alyzia-status-filter-css">.alz-status-hidden{display:none!important}
.alz-search-row{display:flex;flex-wrap:nowrap;align-items:center;justify-content:flex-start;gap:10px;margin:0 0 12px}
.alz-search-row .home-flight-search{flex:1 1 auto!important;min-width:0!important;width:auto!important;margin:0!important}
.alz-status-wrap{flex:0 0 auto;position:relative;margin-left:0}
.alz-status-btn{display:inline-flex;align-items:center;gap:7px;height:46px;padding:0 15px;border:2px solid #d8e3ee;border-radius:999px;background:#fff;color:#28425f;font:900 12px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap;cursor:pointer}
.alz-status-btn.active{border-color:#0b70d1;background:#0b70d1;color:#fff}
.alz-status-btn .alz-caret{font-size:10px;opacity:.75}
.alz-status-band{display:flex;flex-wrap:nowrap;gap:8px;align-items:center;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;margin:-4px 0 12px;padding:2px 2px 6px;scroll-snap-type:x proximity}
.alz-status-band::-webkit-scrollbar{display:none}
.alz-status-band[hidden]{display:none}
.alz-sf-item{flex:0 0 auto;scroll-snap-align:start;display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 15px;border:2px solid #d8e3ee;border-radius:999px;background:#fff;color:#28425f;font:900 12px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap;cursor:pointer}
.alz-sf-item b{font-size:12px;color:#6b7f95;font-weight:900}
.alz-sf-item.active{border-color:#0b70d1;background:#0b70d1;color:#fff}.alz-sf-item.active b{color:#dcecff}
.alz-sf-item.zero:not(.active){opacity:.45}
@media(max-width:800px){.alz-status-btn{height:44px;padding:0 13px}.alz-sf-item{height:40px;padding:0 13px}}</style>
<script id="alyzia-status-filter-js">(function(){
if(window.__alyziaStatusFilter)return;window.__alyziaStatusFilter=true;
var KEYS=[['HEURE','À L’HEURE'],['EMBARQ','EMBARQUEMENT'],['RETARD','RETARDÉ'],['PARTI','PARTI'],['ENVOL','EN VOL'],['ATTERRI','ATTERRI'],['ARRIVE','ARRIVÉ'],['ANNULE','ANNULÉ']];
var STORE='alyziaStatusFilter',OPEN='alyziaStatusBand',selected='',menuOpen=false;
try{selected=sessionStorage.getItem(STORE)||'';menuOpen=sessionStorage.getItem(OPEN)==='1'}catch(e){}
function save(){try{selected?sessionStorage.setItem(STORE,selected):sessionStorage.removeItem(STORE)}catch(e){}}
function labelOf(k){for(var i=0;i<KEYS.length;i++)if(KEYS[i][0]===k)return KEYS[i][1];return 'STATUT'}
function norm(t){return String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim()}
function keyOf(text){var t=norm(text);if(!t)return 'AUTRE';if(t.indexOf('EMBARQ')===0)return 'EMBARQ';if(t.indexOf('RETARD')===0)return 'RETARD';if(t.indexOf('ANNUL')===0)return 'ANNULE';if(t.indexOf('ARRIV')===0)return 'ARRIVE';if(t.indexOf('ATTERR')===0||t.indexOf('ATTERI')===0)return 'ATTERRI';if(t==='EN VOL')return 'ENVOL';if(t.indexOf('PARTI')===0)return 'PARTI';if(t.indexOf("A L'HEURE")===0||t==='PREVU'||t==='PROGRAMME')return 'HEURE';return 'AUTRE'}
function rows(){return Array.prototype.slice.call(document.querySelectorAll('#app .flight-home-row'))}
function rowKey(row){var b=row.querySelector('.ops-status-badge');return keyOf(b?b.textContent:'')}
function visibleWithoutUs(r){var had=r.classList.contains('alz-status-hidden');if(had)r.classList.remove('alz-status-hidden');var ok=getComputedStyle(r).display!=='none';if(had)r.classList.add('alz-status-hidden');return ok}
// Nombre de vols par statut dans la sélection affichée (terminal, recherche, favoris, tranche horaire), sans tenir compte du statut choisi.
function counts(){var c={};rows().forEach(function(r){if(r.classList.contains('ops-skip')||!visibleWithoutUs(r))return;var k=rowKey(r);c[k]=(c[k]||0)+1});return c}
function setOpen(v){menuOpen=!!v;try{menuOpen?sessionStorage.setItem(OPEN,'1'):sessionStorage.removeItem(OPEN)}catch(e){}var m=document.querySelector('#app .alz-status-band'),b=document.querySelector('#app .alz-status-btn');if(m)m.hidden=!menuOpen;if(b)b.setAttribute('aria-expanded',menuOpen?'true':'false')}
function build(search){
  var wrap=search.parentNode&&search.parentNode.classList&&search.parentNode.classList.contains('alz-search-row')?search.parentNode:null;
  if(!wrap){wrap=document.createElement('div');wrap.className='alz-search-row';search.parentNode.insertBefore(wrap,search);wrap.appendChild(search)}
  var box=document.createElement('div');box.className='alz-status-wrap';
  box.innerHTML='<button type="button" class="alz-status-btn" aria-haspopup="listbox" aria-expanded="false"><span class="alz-lbl">STATUT</span><span class="alz-caret">▾</span></button>';wrap.appendChild(box);
  var band=document.createElement('div');band.className='alz-status-band';band.setAttribute('role','listbox');band.setAttribute('aria-label','Statut des vols');band.hidden=true;
  var html='<button type="button" role="option" class="alz-sf-item" data-k="*"><span>TOUS LES STATUTS</span><b>0</b></button>';
  KEYS.forEach(function(p){html+='<button type="button" role="option" class="alz-sf-item zero" data-k="'+p[0]+'"><span>'+p[1]+'</span><b>0</b></button>'});
  band.innerHTML=html;wrap.parentNode.insertBefore(band,wrap.nextSibling);
  // La croix d'effacement de la recherche se repositionne selon la nouvelle largeur de la recherche.
  setTimeout(function(){try{window.dispatchEvent(new Event('resize'))}catch(e){}},0);
}
function sync(){
  var search=document.querySelector('#app .home-flight-search');if(!search)return;
  var box=document.querySelector('#app .alz-status-wrap');if(!box){build(search);box=document.querySelector('#app .alz-status-wrap');setOpen(menuOpen)}
  var c=counts(),total=0;Object.keys(c).forEach(function(k){total+=c[k]});
  Array.prototype.forEach.call(document.querySelectorAll('#app .alz-status-band .alz-sf-item'),function(b){
    var k=b.getAttribute('data-k'),n=k==='*'?total:(c[k]||0),nb=b.querySelector('b'),on=k==='*'?!selected:selected===k;
    if(nb&&nb.textContent!==String(n))nb.textContent=n;
    b.classList.toggle('active',on);b.setAttribute('aria-selected',on?'true':'false');
    b.classList.toggle('zero',k!=='*'&&!n);
  });
  var btn=box.querySelector('.alz-status-btn'),lbl=btn.querySelector('.alz-lbl'),txt=selected?labelOf(selected):'STATUT';
  if(lbl.textContent!==txt)lbl.textContent=txt;btn.classList.toggle('active',!!selected);
  var visible=0;
  rows().forEach(function(r){var hide=!!selected&&rowKey(r)!==selected;r.classList.toggle('alz-status-hidden',hide);if(!hide&&getComputedStyle(r).display!=='none'&&!r.classList.contains('ops-skip'))visible++});
  var badge=document.getElementById('homeVisibleFlightCount');if(badge){var t=visible+' VOL'+(visible>1?'S':'');if(badge.textContent!==t)badge.textContent=t}
}
document.addEventListener('click',function(e){
  var t=e.target&&e.target.closest?e.target:null;if(!t)return;
  var btn=t.closest('.alz-status-btn');if(btn){e.preventDefault();setOpen(!menuOpen);return}
  var it=t.closest('.alz-sf-item');if(it){e.preventDefault();var k=it.getAttribute('data-k');selected=(k==='*'||selected===k)?'':k;save();setOpen(false);sync();return}
  if(menuOpen&&!t.closest('.alz-status-wrap,.alz-status-band'))setOpen(false);
},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&menuOpen)setOpen(false)});
var timer=null;function later(){clearTimeout(timer);timer=setTimeout(sync,300)}
document.addEventListener('input',function(e){if(e.target&&e.target.closest&&e.target.closest('.home-flight-search'))later()},true);
document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#app .terminal-filter-bar,#app .home-pin,#app .alyzia-time-filter-wrap,#app .alyzia-home-clear,#app .day-nav-btn'))setTimeout(later,0)},true);
// Quand l'application redessine la liste (rafraîchissement), le bouton et le filtre sont remis AVANT l'affichage suivant, par un passage léger (aucune mesure de mise en page).
// Le calcul complet des nombres reste espacé (300 ms) : l'application a déjà beaucoup d'observateurs et ne doit pas être ralentie.
function quick(){
  var search=document.querySelector('#app .home-flight-search');if(!search)return;
  if(!document.querySelector('#app .alz-status-wrap')){build(search);setOpen(menuOpen)}
  var lb=document.querySelector('#app .alz-status-btn .alz-lbl'),bt=document.querySelector('#app .alz-status-btn');if(lb){var tx=selected?labelOf(selected):'STATUT';if(lb.textContent!==tx)lb.textContent=tx;bt.classList.toggle('active',!!selected)}
  if(selected)rows().forEach(function(r){var hide=rowKey(r)!==selected;if(r.classList.contains('alz-status-hidden')!==hide)r.classList.toggle('alz-status-hidden',hide)});
}
function own(n){return !!(n&&n.closest&&n.closest('.alz-status-wrap,.alz-status-band'))}
try{new MutationObserver(function(list){
  for(var i=0;i<list.length;i++){var t=list[i].target;if(!own(t.nodeType===1?t:t.parentNode)){quick();later();return}}
}).observe(document.getElementById('app')||document.body,{childList:true,subtree:true})}catch(e){}
[0,300,900].forEach(function(ms){setTimeout(sync,ms)});
window.__alyziaStatusFilterKey=keyOf;
})();</script>`;
