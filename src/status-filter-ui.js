// Liste des vols (accueil) : un seul bouton « STATUT » à côté de la barre de recherche. Il ouvre une liste des seuls statuts présents dans la sélection affichée (terminal, recherche, favoris, tranche horaire), avec leur nombre de vols ; on en choisit un.
// La recherche garde sa largeur. Le nombre de chaque statut suit le terminal, la recherche, les favoris et la tranche horaire ; la liste affichée cumule le statut choisi avec ces filtres.
export const STATUS_FILTER_UI = String.raw`<style id="alyzia-status-filter-css">.alz-status-hidden{display:none!important}
/* Plus spécifique que les règles d'affichage des cartes de l'application (#app .flight-home-row.ops-flight-card{display:…!important}) : sans cela le filtre ne cachait rien. */
html body #app .flight-home-row.alz-status-hidden.alz-status-hidden,html body #app .flight-home-row.ops-flight-card.alz-status-hidden.alz-status-hidden{display:none!important}
.alz-search-row{position:relative;display:flex;flex-wrap:nowrap;align-items:center;justify-content:flex-start;gap:10px;margin:0 0 12px;padding-right:126px;box-sizing:border-box}
.alz-search-row .home-flight-search{flex:1 1 auto!important;min-width:0!important;width:auto!important;margin:0!important}
.alz-status-wrap{position:absolute;top:50%;transform:translateY(-50%);left:calc(min(650px,100% - 126px) + 10px)}
.alz-status-btn{display:inline-flex;align-items:center;gap:7px;height:46px;padding:0 15px;border:2px solid #d8e3ee;border-radius:999px;background:#fff;color:#28425f;font:900 12px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap;cursor:pointer}
.alz-status-btn.active{border-color:#0b70d1;background:#0b70d1;color:#fff}
.alz-status-btn .alz-caret{font-size:10px;opacity:.75}
.alz-status-band{position:absolute;right:0;top:calc(100% + 6px);z-index:9999;min-width:230px;max-height:62vh;overflow-y:auto;display:flex;flex-direction:column;gap:2px;padding:6px;border:1px solid #d8e3ee;border-radius:16px;background:#fff;box-shadow:0 12px 32px rgba(20,48,80,.22)}
.alz-status-band[hidden]{display:none}
.alz-sf-item{position:relative;display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;min-height:44px;padding:0 12px 0 32px;border:0;border-radius:11px;background:transparent;color:#28425f;font:900 13px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:left;white-space:nowrap;cursor:pointer}
.alz-sf-item b{font-size:12px;color:#6b7f95;font-weight:900}
.alz-sf-item.active{background:#eaf3fe;color:#0868c2}.alz-sf-item.active b{color:#0868c2}
.alz-sf-item.active::before{content:"✓";position:absolute;left:12px;font-size:13px}
.alz-sf-item.zero:not(.active){display:none}
@media(max-width:800px){.alz-status-btn{height:44px;padding:0 13px}.alz-status-band{min-width:min(260px,calc(100vw - 32px))}}</style>
<script id="alyzia-status-filter-js">(function(){
if(window.__alyziaStatusFilter)return;window.__alyziaStatusFilter=true;
var KEYS=[['HEURE','À L’HEURE'],['EMBARQ','EMBARQUEMENT'],['RETARD','RETARDÉ'],['PARTI','PARTI'],['ENVOL','EN VOL'],['ATTERRI','ATTERRI'],['ARRIVE','ARRIVÉ'],['ANNULE','ANNULÉ']];
var deferred=0,swallow=0,STORE='alyziaStatusFilter',OPEN='alyziaStatusBand',selected='',menuOpen=false;
// Par défaut tous les statuts : le choix reste en mémoire pendant la visite (il survit aux rafraîchissements de la liste) mais n'est pas gardé d'une ouverture de la page à l'autre.
function save(){}
function labelOf(k){for(var i=0;i<KEYS.length;i++)if(KEYS[i][0]===k)return KEYS[i][1];return 'STATUT'}
function norm(t){return String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim()}
function keyOf(text){var t=norm(text);if(!t)return 'AUTRE';if(t.indexOf('EMBARQ')===0)return 'EMBARQ';if(t.indexOf('RETARD')===0)return 'RETARD';if(t.indexOf('ANNUL')===0)return 'ANNULE';if(t.indexOf('ARRIV')===0)return 'ARRIVE';if(t.indexOf('ATTERR')===0||t.indexOf('ATTERI')===0)return 'ATTERRI';if(t==='EN VOL')return 'ENVOL';if(t.indexOf('PARTI')===0)return 'PARTI';if(t.indexOf("A L'HEURE")===0||t==='PREVU'||t==='PROGRAMME')return 'HEURE';return 'AUTRE'}
function rows(){return Array.prototype.slice.call(document.querySelectorAll('#app .flight-home-row'))}
function rowKey(row){var b=row.querySelector('.ops-status-badge');return keyOf(b?b.textContent:'')}
function visibleWithoutUs(r){var had=r.classList.contains('alz-status-hidden');if(had)r.classList.remove('alz-status-hidden');var ok=getComputedStyle(r).display!=='none';if(had)r.classList.add('alz-status-hidden');return ok}
// Nombre de vols par statut dans la sélection affichée (terminal, recherche, favoris, tranche horaire), sans tenir compte du statut choisi.
function counts(){var c={};rows().forEach(function(r){if(r.classList.contains('ops-skip')||!visibleWithoutUs(r))return;var k=rowKey(r);c[k]=(c[k]||0)+1});return c}
function setOpen(v){menuOpen=!!v;var m=document.querySelector('#app .alz-status-band'),b=document.querySelector('#app .alz-status-btn');if(m)m.hidden=!menuOpen;if(b)b.setAttribute('aria-expanded',menuOpen?'true':'false')}
function build(search){
  var wrap=search.parentNode&&search.parentNode.classList&&search.parentNode.classList.contains('alz-search-row')?search.parentNode:null;
  if(!wrap){wrap=document.createElement('div');wrap.className='alz-search-row';search.parentNode.insertBefore(wrap,search);wrap.appendChild(search)}
  // Mise en page posée en ligne : rien dans la feuille de style de l'application ne la repousse (bouton collé à la recherche).
  wrap.style.setProperty('display','flex','important');wrap.style.setProperty('justify-content','flex-start','important');wrap.style.setProperty('flex-wrap','nowrap','important');wrap.style.setProperty('align-items','center','important');wrap.style.setProperty('width','100%','important');wrap.style.setProperty('padding-right','126px','important');wrap.style.setProperty('box-sizing','border-box','important');wrap.style.setProperty('position','relative','important');
  search.style.setProperty('flex','0 1 650px','important');search.style.setProperty('max-width','650px','important');search.style.setProperty('min-width','0','important');search.style.setProperty('margin','0','important');
  var box=document.createElement('div');box.className='alz-status-wrap';
  box.innerHTML='<button type="button" class="alz-status-btn" aria-haspopup="listbox" aria-expanded="false"><span class="alz-lbl">STATUT</span><span class="alz-caret">▾</span></button>';wrap.appendChild(box);
  var band=document.createElement('div');band.className='alz-status-band';band.setAttribute('role','listbox');band.setAttribute('aria-label','Statut des vols');band.hidden=true;
  var html='<button type="button" role="option" class="alz-sf-item" data-k="*"><span>TOUS LES STATUTS</span><b></b></button>';
  KEYS.forEach(function(p){html+='<button type="button" role="option" class="alz-sf-item zero" data-k="'+p[0]+'"><span>'+p[1]+'</span><b></b></button>'});
  band.innerHTML=html;box.appendChild(band);
  // La croix d'effacement de la recherche se repositionne selon la nouvelle largeur de la recherche.
  setTimeout(function(){try{window.dispatchEvent(new Event('resize'))}catch(e){}},0);
}
function sync(){
  var search=document.querySelector('#app .home-flight-search');if(!search)return;
  hook();try{window.__alyziaApplyHomeFilters&&window.__alyziaApplyHomeFilters()}catch(e){}
  // Des cartes pas encore construites : on attend la suite plutôt que de compter un état intermédiaire.
  if(deferred<3&&rows().some(function(r){return !r.classList.contains('ops-flight-card')&&!r.classList.contains('ops-skip')})){deferred++;later();return}
  deferred=0;
  var box=document.querySelector('#app .alz-status-wrap');if(!box){build(search);box=document.querySelector('#app .alz-status-wrap');setOpen(menuOpen)}
  var c=counts(),total=0;Object.keys(c).forEach(function(k){total+=c[k]});
  // Un statut qui n'a plus aucun vol dans la sélection (filtres changés) ne reste pas choisi : la liste ne se retrouve pas vide.
  if(selected&&total>0&&!c[selected]){selected='';save()}
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
// Le choix se fait à l'appui (pointerdown) : si l'application redessine la liste entre l'appui et le relâchement, le bouton est remplacé et le « click » se perd (il fallait appuyer plusieurs fois).
// Le click qui suit un appui déjà traité est ignoré ; un click seul (clavier) fonctionne aussi.
function act(e,fromPointer){
  var t=e.target&&e.target.closest?e.target:null;if(!t)return false;
  var btn=t.closest('.alz-status-btn'),it=t.closest('.alz-sf-item');
  if(btn){e.preventDefault();if(fromPointer)swallow=Date.now()+700;setOpen(!menuOpen);return true}
  if(it){e.preventDefault();if(fromPointer)swallow=Date.now()+700;var k=it.getAttribute('data-k');selected=(k==='*'||selected===k)?'':k;save();setOpen(false);quick();sync();return true}
  if(menuOpen&&!t.closest('.alz-status-wrap,.alz-status-band'))setOpen(false);
  return false;
}
document.addEventListener('pointerdown',function(e){if(e.button===undefined||e.button===0)act(e,true)},true);
document.addEventListener('click',function(e){
  var t=e.target&&e.target.closest?e.target:null;if(t&&t.closest('.alz-status-wrap,.alz-status-band')){e.preventDefault();if(Date.now()<swallow)return;act(e,false);return}
},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&menuOpen)setOpen(false)});
var timer=null;function later(){clearTimeout(timer);timer=setTimeout(sync,300)}
document.addEventListener('input',function(e){if(e.target&&e.target.closest&&e.target.closest('.home-flight-search'))later()},true);
document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#app .terminal-filter-bar,#app .home-pin,#app .alyzia-time-filter-wrap,#app .alyzia-home-clear,#app .day-nav-btn'))setTimeout(later,0)},true);
// Quand l'application redessine la liste (rafraîchissement), le bouton et le filtre sont remis AVANT l'affichage suivant, par un passage léger (aucune mesure de mise en page).
// Le calcul complet des nombres reste espacé (300 ms) : l'application a déjà beaucoup d'observateurs et ne doit pas être ralentie.
function hook(){var o=window.__alyziaApplyHomeFilters;if(typeof o==='function'&&!o.__alz){var f=function(){var r=o.apply(this,arguments);try{quick()}catch(e){}return r};f.__alz=1;window.__alyziaApplyHomeFilters=f}}
function quick(){
  hook();
  var search=document.querySelector('#app .home-flight-search');if(!search)return;
  if(!document.querySelector('#app .alz-status-wrap')){build(search);setOpen(menuOpen)}
  var lb=document.querySelector('#app .alz-status-btn .alz-lbl'),bt=document.querySelector('#app .alz-status-btn');if(lb){var tx=selected?labelOf(selected):'STATUT';if(lb.textContent!==tx)lb.textContent=tx;bt.classList.toggle('active',!!selected)}
  if(selected)rows().forEach(function(r){var hide=rowKey(r)!==selected;if(r.classList.contains('alz-status-hidden')!==hide)r.classList.toggle('alz-status-hidden',hide)});
}
function own(n){return !!(n&&n.closest&&n.closest('.alz-status-wrap,.alz-status-band'))}
try{new MutationObserver(function(list){
  for(var i=0;i<list.length;i++){var t=list[i].target;if(!own(t.nodeType===1?t:t.parentNode)){quick();later();return}}
}).observe(document.getElementById('app')||document.body,{childList:true,subtree:true})}catch(e){}
[0,300,900,2000].forEach(function(ms){setTimeout(function(){hook();sync()},ms)});
window.__alyziaStatusFilterKey=keyOf;
})();</script>`;
