// Liste des vols (accueil) : filtre par statut, juste sous la barre de recherche. Choix multiples (À L'HEURE, EMBARQUEMENT, RETARDÉ, PARTI, EN VOL, ATTERRI, ARRIVÉ, ANNULÉ), avec le nombre de vols de chaque statut.
// Il se cumule avec la recherche, les terminaux, les favoris et les tranches horaires : il ne masque que les lignes dont le statut n'est pas coché.
export const STATUS_FILTER_UI = String.raw`<style id="alyzia-status-filter-css">.alz-status-hidden{display:none!important}
.alz-status-filter{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0 12px}
.alz-sf-chip{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border:2px solid #d8e3ee;border-radius:999px;background:#fff;color:#28425f;font:900 11.5px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap;cursor:pointer}
.alz-sf-chip b{font-size:11px;color:#6b7f95;font-weight:900}
.alz-sf-chip.active{border-color:#0b70d1;background:#eef6ff;color:#0868c2}.alz-sf-chip.active b{color:#0868c2}
.alz-sf-chip.zero:not(.active){opacity:.45}
.alz-sf-reset{border-style:dashed}
@media(max-width:700px){.alz-status-filter{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px;scrollbar-width:none}.alz-status-filter::-webkit-scrollbar{display:none}.alz-sf-chip{flex:0 0 auto;height:34px;padding:0 11px}}</style>
<script id="alyzia-status-filter-js">(function(){
if(window.__alyziaStatusFilter)return;window.__alyziaStatusFilter=true;
var KEYS=[['HEURE','À L’HEURE'],['EMBARQ','EMBARQUEMENT'],['RETARD','RETARDÉ'],['PARTI','PARTI'],['ENVOL','EN VOL'],['ATTERRI','ATTERRI'],['ARRIVE','ARRIVÉ'],['ANNULE','ANNULÉ']];
var STORE='alyziaStatusFilter',selected={};
try{var raw=sessionStorage.getItem(STORE);if(raw)JSON.parse(raw).forEach(function(k){selected[k]=true})}catch(e){}
function save(){try{var l=Object.keys(selected);l.length?sessionStorage.setItem(STORE,JSON.stringify(l)):sessionStorage.removeItem(STORE)}catch(e){}}
function norm(t){return String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim()}
function keyOf(text){var t=norm(text);if(!t)return 'AUTRE';if(t.indexOf('EMBARQ')===0)return 'EMBARQ';if(t.indexOf('RETARD')===0)return 'RETARD';if(t.indexOf('ANNUL')===0)return 'ANNULE';if(t.indexOf('ARRIV')===0)return 'ARRIVE';if(t.indexOf('ATTERR')===0||t.indexOf('ATTERI')===0)return 'ATTERRI';if(t==='EN VOL')return 'ENVOL';if(t.indexOf('PARTI')===0)return 'PARTI';if(t.indexOf("A L'HEURE")===0||t==='PREVU'||t==='PROGRAMME')return 'HEURE';return 'AUTRE'}
function rows(){return Array.prototype.slice.call(document.querySelectorAll('#app .flight-home-row'))}
function rowKey(row){var b=row.querySelector('.ops-status-badge');return keyOf(b?b.textContent:'')}
function active(){return Object.keys(selected).length>0}
function counts(){var c={};rows().forEach(function(r){if(r.classList.contains('ops-skip'))return;var k=rowKey(r);c[k]=(c[k]||0)+1});return c}
function build(host){
  var c=counts(),bar=document.createElement('div');bar.className='alz-status-filter';bar.setAttribute('role','group');bar.setAttribute('aria-label','Filtrer par statut');
  var html='<button type="button" class="alz-sf-chip alz-sf-reset'+(active()?'':' active')+'" data-k="*">TOUS</button>';
  KEYS.forEach(function(p){var n=c[p[0]]||0;html+='<button type="button" class="alz-sf-chip'+(selected[p[0]]?' active':'')+(n?'':' zero')+'" data-k="'+p[0]+'">'+p[1]+' <b>'+n+'</b></button>'});
  bar.innerHTML=html;host.parentNode.insertBefore(bar,host.nextSibling);
}
function sync(){
  var host=document.querySelector('#app .home-flight-search');if(!host)return;
  var bar=document.querySelector('#app .alz-status-filter');if(!bar){build(host);bar=document.querySelector('#app .alz-status-filter')}
  var c=counts();
  Array.prototype.forEach.call(bar.querySelectorAll('.alz-sf-chip'),function(b){var k=b.getAttribute('data-k');if(k==='*'){b.classList.toggle('active',!active());return}var n=c[k]||0,nb=b.querySelector('b');if(nb&&nb.textContent!==String(n))nb.textContent=n;b.classList.toggle('zero',!n);b.classList.toggle('active',!!selected[k])});
  var on=active(),visible=0;
  rows().forEach(function(r){var hide=on&&!selected[rowKey(r)];r.classList.toggle('alz-status-hidden',hide);if(!hide&&getComputedStyle(r).display!=='none'&&!r.classList.contains('ops-skip'))visible++});
  var badge=document.getElementById('homeVisibleFlightCount');if(badge&&on){var t=visible+' VOL'+(visible>1?'S':'');if(badge.textContent!==t)badge.textContent=t}
}
document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('.alz-sf-chip');if(!b)return;e.preventDefault();var k=b.getAttribute('data-k');if(k==='*')selected={};else if(selected[k])delete selected[k];else selected[k]=true;save();sync()});
var timer=null;function later(){clearTimeout(timer);timer=setTimeout(sync,60)}
try{new MutationObserver(later).observe(document.getElementById('app')||document.body,{childList:true,subtree:true})}catch(e){}
[0,300,900].forEach(function(ms){setTimeout(sync,ms)});
window.__alyziaStatusFilterKey=keyOf;
})();</script>`;
