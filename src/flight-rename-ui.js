// INFOS VOL de la fiche : le numéro du vol devient modifiable. Le changement est fait côté serveur (/api/flights/rename) : il déplace notes, pièces jointes, dossier Drive et PRÉPA,
// puis la page se recharge pour que la liste, la recherche et la fiche affichent le nouveau numéro. L'historique garde la date et l'heure du changement et l'ancien numéro.
export const FLIGHT_RENAME_UI = String.raw`<style id="alyzia-flight-rename-css">.alz-rename b{font-size:1.15em}.alz-rename-note{margin-top:4px;font-size:11px;font-weight:800;color:#8a6d3b}.alz-rename-btn{margin-top:8px;border:1px solid #c7d6e6;background:#f3f8fd;color:#1d4570;border-radius:10px;padding:6px 12px;font-weight:900;font-size:12px;cursor:pointer}.alz-rename-form{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}.alz-rename-form input{flex:1 1 140px;min-width:0;border:1px solid #c7d6e6;border-radius:10px;padding:8px 10px;font:inherit;font-weight:900;text-transform:uppercase}.alz-rename-msg{flex-basis:100%;font-size:12px;font-weight:800}.alz-rename-msg.err{color:#b3261e}.alz-rename-msg.ok{color:#12a150}</style>
<script id="alyzia-flight-rename-js">(function(){
if(window.__alyziaFlightRename)return;window.__alyziaFlightRename=true;
var ERR={NUMERO_INVALIDE:'Numéro invalide : il doit commencer par le code de la compagnie suivi de 1 à 4 chiffres.',NUMERO_DEJA_UTILISE:'Ce numéro existe déjà pour ce jour.',NUMERO_IDENTIQUE:'Le numéro est inchangé.',VOL_INTROUVABLE:'Vol introuvable sur le serveur.'};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function fmt(at){try{return new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(at)).replace(',','')}catch(e){return ''}}
function lastChange(x){var l=Array.isArray(x&&x.flightInfoLog)?x.flightInfoLog:[];for(var i=0;i<l.length;i++){if(l[i]&&l[i].field==='flight')return l[i]}return null}
function identityOf(x){return typeof flightImportIdentity==='function'?flightImportIdentity(x):[x.date,x.airline,x.flight].join('|')}
function apiUrl(p){return typeof opsApiUrl==='function'?opsApiUrl(p):p}
async function save(x,value,msg,btn){
  msg.className='alz-rename-msg';msg.textContent='ENREGISTREMENT…';btn.disabled=true;
  try{
    var r=await fetch(apiUrl('/api/flights/rename'),{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({identity:identityOf(x),newFlight:value})});
    var j=await r.json().catch(function(){return {}});
    if(r.ok&&j.ok){msg.className='alz-rename-msg ok';msg.textContent='NUMÉRO MODIFIÉ : '+j.from+' → '+j.to+' · RECHARGEMENT…';setTimeout(function(){location.reload()},900);return}
    msg.className='alz-rename-msg err';msg.textContent=ERR[j.error]||j.detail||('Échec ('+(j.error||r.status)+')');
  }catch(e){msg.className='alz-rename-msg err';msg.textContent='Échec : serveur injoignable.'}
  btn.disabled=false;
}
function openForm(x,item){
  var holder=item.querySelector('.alz-rename-slot');if(!holder||holder.firstChild)return;
  holder.innerHTML='<div class="alz-rename-form"><input type="text" inputmode="text" autocomplete="off" value="'+esc(x.flight)+'" aria-label="Nouveau numéro de vol"><button type="button" class="alz-rename-btn" data-act="ok">ENREGISTRER</button><button type="button" class="alz-rename-btn" data-act="no">ANNULER</button><div class="alz-rename-msg"></div></div>';
  var input=holder.querySelector('input'),msg=holder.querySelector('.alz-rename-msg'),ok=holder.querySelector('[data-act=ok]'),no=holder.querySelector('[data-act=no]');
  input.focus();input.select();
  input.addEventListener('input',function(){input.value=input.value.toUpperCase().replace(/\s+/g,'')});
  ok.onclick=function(){var v=input.value.trim().toUpperCase();if(!v){msg.className='alz-rename-msg err';msg.textContent='Saisis le nouveau numéro.';return}save(x,v,msg,ok)};
  no.onclick=function(){holder.innerHTML=''};
  input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();ok.click()}});
}
function inject(){
  var grid=document.querySelector('.flight-info-grid');if(!grid||grid.querySelector('.alz-rename'))return;
  var x=typeof f==='function'?f():null;if(!x)return;
  var c=lastChange(x),item=document.createElement('div');item.className='flight-info-item alz-rename';
  item.innerHTML='<small>NUMÉRO DE VOL</small><b>'+esc(x.flight)+'</b>'+(c?'<div class="alz-rename-note">MODIFIÉ LE '+esc(fmt(c.at))+' · ANCIEN NUMÉRO '+esc(c.from)+'</div>':'')+'<button type="button" class="alz-rename-btn" data-act="edit">MODIFIER LE NUMÉRO</button><div class="alz-rename-slot"></div>';
  grid.insertBefore(item,grid.firstChild);
  item.querySelector('[data-act=edit]').onclick=function(){openForm(x,item)};
}
function wrap(){
  var o=window.openFlightInfo;if(typeof o!=='function'||o.__alzRename)return false;
  var w=function(){var r=o.apply(this,arguments);setTimeout(inject,0);setTimeout(inject,120);return r};w.__alzRename=true;window.openFlightInfo=w;return true;
}
if(!wrap()){var n=0,t=setInterval(function(){if(wrap()||++n>40)clearInterval(t)},250)}
})();</script>`;
