// Liste des vols (accueil) : filtre par statut construit comme le filtre des tranches horaires (HORAIRES) : un bouton dans la même rangée de contrôles (T1 T2 T3 ALL ★ HORAIRES),
// qui ouvre un menu ; le choix cache les cartes par une classe, comme le font les tranches horaires. Par défaut « TOUS » : tous les statuts sont affichés.
// Ordre du menu : TOUS, PARTI, À L'HEURE, RETARDÉ, EN VOL, EMBARQUEMENT (+ CLOS), ATTERRI, ARRIVÉE, ANNULÉ. Le nombre de vols de chaque statut suit le terminal, la recherche, les favoris et la tranche horaire.
export const STATUS_FILTER_UI = String.raw`<style id="alyzia-status-filter-css">.alyzia-status-hidden{display:none!important}
html body #app .flight-home-row.alyzia-status-hidden.alyzia-status-hidden,html body #app .flight-home-row.ops-flight-card.alyzia-status-hidden.alyzia-status-hidden{display:none!important}
#app .alyzia-status-filter-wrap{position:relative;display:inline-flex!important;align-items:center;margin-left:8px;vertical-align:middle}
#app .alyzia-status-filter-btn{height:46px;min-width:62px;padding:0 15px;border:2px solid #d8e3ee;border-radius:999px;background:#fff;color:#28425f;font:900 12px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap}
#app .alyzia-status-filter-btn.active{border-color:#0b70d1;background:#eef6ff;color:#0868c2}
#app .alyzia-status-filter-btn i{font-style:normal;font-size:10px;opacity:.7}
#app .alyzia-status-filter-menu{position:absolute;left:0;top:52px;z-index:200;display:none;gap:4px;padding:8px;background:#fff;border:1px solid #d9e4ef;border-radius:14px;box-shadow:0 10px 28px rgba(22,48,86,.15);min-width:250px}
#app .alyzia-status-filter-menu.open{display:grid!important}
#app .alyzia-status-choice{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;height:40px;padding:0 10px;border:1px solid transparent;border-radius:10px;background:#fff;color:#28425f;font:900 12px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:left;white-space:nowrap;cursor:pointer}
#app .alyzia-status-choice b{font-size:12px;color:#6b7f95;font-weight:900}
#app .alyzia-status-choice.zero:not(.active){opacity:.45}
#app .alyzia-status-choice.active{background:#0b70d1;color:#fff;border-color:#0b70d1}#app .alyzia-status-choice.active b{color:#dcecff}
#app .alyzia-status-choice>span{display:inline-flex;align-items:center;padding:5px 10px;border-radius:7px;border:1px solid transparent}
#app .alyzia-status-choice[data-k="*"]>span{padding:5px 0}
#app .alyzia-status-choice[data-k="HEURE"]>span,#app .alyzia-status-choice[data-k="EMBARQ"]>span{background:#e1f5e9;color:#16794a;border-color:#b6e2c8}
#app .alyzia-status-choice[data-k="RETARD"]>span{background:#fff0d0;color:#965600;border-color:#f1d08e}
#app .alyzia-status-choice[data-k="PARTI"]>span,#app .alyzia-status-choice[data-k="ATTERRI"]>span{background:#e6f8f3;color:#008f74;border-color:#bfe9de}
#app .alyzia-status-choice[data-k="ENVOL"]>span{background:#dcecff;color:#0b5cad;border-color:#b8d6f6}
#app .alyzia-status-choice[data-k="ARRIVE"]>span{background:#d7efec;color:#0a665e;border-color:#a9d9d3}
#app .alyzia-status-choice[data-k="ANNULE"]>span{background:#ffe1e5;color:#b3243b;border-color:#f3b5bf}
#app .alyzia-status-row{display:block;margin:8px 0 2px;padding:0 2px}
@media(max-width:900px){#app .alyzia-status-filter-wrap{margin-left:0}#app .alyzia-status-filter-btn{height:44px;min-width:58px}#app .alyzia-status-filter-menu{min-width:min(250px,calc(100vw - 32px))}}</style>
<script id="alyzia-status-filter-js">(function(){
if(window.__alyziaStatusFilter)return;window.__alyziaStatusFilter=true;
var KEYS=[['PARTI','PARTI'],['HEURE','À L’HEURE'],['RETARD','RETARDÉ'],['ENVOL','EN VOL'],['EMBARQ','EMBARQUEMENT + CLOS'],['ATTERRI','ATTERRI'],['ARRIVE','ARRIVÉE'],['ANNULE','ANNULÉ']];
var selected='',menuOpen=false,lastToggle=0,deferred=0;
function labelOf(k){for(var i=0;i<KEYS.length;i++)if(KEYS[i][0]===k)return KEYS[i][1];return 'TOUS'}
function norm(t){return String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim()}
function keyOf(text){var t=norm(text);if(!t)return 'AUTRE';if(t.indexOf('EMBARQ')===0)return 'EMBARQ';if(t.indexOf('RETARD')===0)return 'RETARD';if(t.indexOf('ANNUL')===0)return 'ANNULE';if(t.indexOf('ARRIV')===0)return 'ARRIVE';if(t.indexOf('ATTERR')===0||t.indexOf('ATTERI')===0)return 'ATTERRI';if(t==='EN VOL')return 'ENVOL';if(t.indexOf('PARTI')===0)return 'PARTI';if(t.indexOf("A L'HEURE")===0||t==='PREVU'||t==='PROGRAMME')return 'HEURE';return 'AUTRE'}
function rows(){return Array.prototype.slice.call(document.querySelectorAll('#app .flight-home-row'))}
function rowKey(row){var b=row.querySelector('.ops-status-badge');return keyOf(b?b.textContent:'')}
// Masquage en double : classe (comme les tranches horaires) ET style en ligne prioritaire, que les règles d'affichage des cartes ne peuvent pas battre.
function setHidden(r,hide){
  if(r.classList.contains('alyzia-status-hidden')!==hide)r.classList.toggle('alyzia-status-hidden',hide);
  if(hide){if(r.style.getPropertyValue('display')!=='none'||r.style.getPropertyPriority('display')!=='important')r.style.setProperty('display','none','important');r.setAttribute('data-alz-hid','1')}
  else if(r.hasAttribute('data-alz-hid')){r.style.removeProperty('display');r.removeAttribute('data-alz-hid')}
}
function visibleWithoutUs(r){var had=r.hasAttribute('data-alz-hid');if(had)setHidden(r,false);var ok=getComputedStyle(r).display!=='none';if(had)setHidden(r,true);return ok}
// Nombre de vols par statut dans la sélection affichée (terminal, recherche, favoris, tranche horaire, vols passés), sans tenir compte du statut choisi.
function counts(){var c={};rows().forEach(function(r){if(r.classList.contains('ops-skip')||!visibleWithoutUs(r))return;var k=rowKey(r);c[k]=(c[k]||0)+1});return c}
function controlsHost(){var all=Array.prototype.slice.call(document.querySelectorAll('#app button')).filter(function(b){return norm(b.textContent)==='ALL'&&!b.closest('.flight-home-row')})[0];return all?all.parentElement:null}
function setOpen(v){menuOpen=!!v;var m=document.querySelector('#app .alyzia-status-filter-menu');if(m)m.classList.toggle('open',menuOpen)}
function ensure(){
  var host=controlsHost();if(!host)return null;
  var wrap=document.querySelector('#app .alyzia-status-filter-wrap');
  if(!wrap){
    wrap=document.createElement('span');wrap.className='alyzia-status-filter-wrap';
    var html='<button type="button" class="alyzia-status-filter-btn" aria-haspopup="listbox" aria-label="Filtrer par statut"><span class="alz-lbl">TOUS</span><i>▾</i></button><span class="alyzia-status-filter-menu" role="listbox" aria-label="Statut des vols">';
    html+='<button type="button" role="option" class="alyzia-status-choice" data-k="*"><span>TOUS</span><b></b></button>';
    KEYS.forEach(function(p){html+='<button type="button" role="option" class="alyzia-status-choice zero" data-k="'+p[0]+'"><span>'+p[1]+'</span><b></b></button>'});
    wrap.innerHTML=html+'</span>';host.appendChild(wrap);setOpen(menuOpen);
  }
  var narrow=window.innerWidth<=900,row=document.querySelector('#app .alyzia-status-row');
  if(narrow){
    // Téléphone : la rangée des contrôles défile et le bouton en sortait ; il a sa propre ligne, juste dessous.
    if(!row){row=document.createElement('div');row.className='alyzia-status-row'}
    if(row.previousElementSibling!==host)host.insertAdjacentElement('afterend',row);
    if(wrap.parentNode!==row)row.appendChild(wrap);
  }else{
    if(row)row.remove();
    // Même rangée que HORAIRES, juste après lui.
    var time=document.querySelector('#app .alyzia-time-filter-wrap');
    if(time&&time.parentNode===host&&time.nextElementSibling!==wrap)time.insertAdjacentElement('afterend',wrap);
    else if(wrap.parentNode!==host)host.appendChild(wrap);
  }
  return wrap;
}
function sync(){
  var wrap=ensure();if(!wrap)return;
  try{window.__alyziaApplyHomeFilters&&window.__alyziaApplyHomeFilters()}catch(e){}
  // Des cartes pas encore construites : on attend la suite plutôt que de compter un état intermédiaire.
  if(deferred<3&&rows().some(function(r){return !r.classList.contains('ops-flight-card')&&!r.classList.contains('ops-skip')})){deferred++;later();return}
  deferred=0;
  var c=counts(),total=0;Object.keys(c).forEach(function(k){total+=c[k]});
  Array.prototype.forEach.call(wrap.querySelectorAll('.alyzia-status-choice'),function(b){
    var k=b.getAttribute('data-k'),n=k==='*'?total:(c[k]||0),nb=b.querySelector('b'),on=k==='*'?!selected:selected===k;
    if(nb&&nb.textContent!==String(n))nb.textContent=n;
    b.classList.toggle('active',on);b.setAttribute('aria-selected',on?'true':'false');b.classList.toggle('zero',k!=='*'&&!n);
  });
  paint(wrap);
  var visible=0;
  rows().forEach(function(r){var hide=!!selected&&rowKey(r)!==selected;setHidden(r,hide);if(!hide&&getComputedStyle(r).display!=='none'&&!r.classList.contains('ops-skip'))visible++});
  var badge=document.getElementById('homeVisibleFlightCount');if(badge){var t=visible+' VOL'+(visible>1?'S':'');if(badge.textContent!==t)badge.textContent=t}
}
function paint(wrap){
  var btn=wrap.querySelector('.alyzia-status-filter-btn'),lbl=btn.querySelector('.alz-lbl'),txt=selected?labelOf(selected):'TOUS';
  if(lbl.textContent!==txt)lbl.textContent=txt;btn.classList.toggle('active',!!selected);
}
// Passage léger après un redessin de la liste : bouton remis et filtre appliqué avant l'affichage suivant, sans mesure de mise en page.
function quick(){
  var wrap=ensure();if(!wrap)return;paint(wrap);
  if(selected)rows().forEach(function(r){setHidden(r,rowKey(r)!==selected)});
}
function hook(){var o=window.__alyziaApplyHomeFilters;if(typeof o==='function'&&!o.__alzStatus){var f=function(){var r=o.apply(this,arguments);try{quick()}catch(e){}return r};f.__alzStatus=1;window.__alyziaApplyHomeFilters=f}}
function choose(k){selected=(k==='*'||selected===k)?'':k;setOpen(false);quick();sync()}
// Comme HORAIRES : bascule à l'appui (pointerdown), donc insensible à un redessin de la liste pendant le clic ; le click qui suit est ignoré.
document.addEventListener('pointerdown',function(e){
  if(e.button>0)return;var t=e.target&&e.target.closest?e.target:null;if(!t)return;
  // Seul le bouton bascule à l'appui. Un choix du menu se fait au click : fermer le menu à l'appui laissait le click tomber sur la carte de vol dessous (la fiche du vol s'ouvrait).
  var btn=t.closest('#app .alyzia-status-filter-btn');
  if(btn){e.preventDefault();e.stopPropagation();lastToggle=Date.now();setOpen(!menuOpen)}
},true);
document.addEventListener('click',function(e){
  var t=e.target&&e.target.closest?e.target:null;if(!t)return;
  var btn=t.closest('#app .alyzia-status-filter-btn'),it=t.closest('#app .alyzia-status-choice');
  if(it){e.preventDefault();e.stopPropagation();choose(it.getAttribute('data-k'));return}
  if(btn){e.preventDefault();e.stopPropagation();if(Date.now()-lastToggle>700)setOpen(!menuOpen);return}
  if(menuOpen&&!t.closest('.alyzia-status-filter-wrap'))setOpen(false);
  if(t.closest('#app .alyzia-home-clear'))selected='';   // la croix efface recherche et filtres, statut compris
  if(t.closest('#app .terminal-filter-bar,#app .home-pin,#app .alyzia-time-filter-wrap,#app .alyzia-home-clear,#app .day-nav-btn'))setTimeout(later,0);
},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&menuOpen)setOpen(false)});
window.addEventListener('resize',function(){later()});
var timer=null;function later(){clearTimeout(timer);timer=setTimeout(sync,300)}
document.addEventListener('input',function(e){if(e.target&&e.target.closest&&e.target.closest('.home-flight-search'))later()},true);
function own(n){return !!(n&&n.closest&&n.closest('.alyzia-status-filter-wrap'))}
try{new MutationObserver(function(list){
  for(var i=0;i<list.length;i++){var t=list[i].target;if(!own(t.nodeType===1?t:t.parentNode)){hook();quick();later();return}}
}).observe(document.getElementById('app')||document.body,{childList:true,subtree:true})}catch(e){}
[0,300,900,2000].forEach(function(ms){setTimeout(function(){hook();sync()},ms)});
setInterval(function(){if(selected&&!document.hidden)quick()},1500);
window.__alyziaStatusFilterKey=keyOf;
window.__alyziaStatusDebug=function(){return {selected:selected,counts:counts(),rows:rows().length,hidden:rows().filter(function(r){return r.hasAttribute('data-alz-hid')}).length,narrow:window.innerWidth<=900}};
})();</script>`;
