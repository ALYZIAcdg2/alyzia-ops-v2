// INFOS VOL de la fiche : le numéro du vol devient modifiable. Le changement est fait côté serveur (/api/flights/rename) : il déplace notes, pièces jointes, dossier Drive et PRÉPA,
// Il porte aussi le lien FR24 du vol (identifiant d'occurrence) : coller l'adresse de la page du vol sur flightradar24.com permet à la lecture FR24 de retrouver ce vol exact (/api/flights/fr24-link).
// puis la page se recharge pour que la liste, la recherche et la fiche affichent le nouveau numéro. L'historique garde la date et l'heure du changement et l'ancien numéro.
export const FLIGHT_RENAME_UI = String.raw`<style id="alyzia-flight-rename-css">.alz-rename b{font-size:1.15em}.alz-rename-note{margin-top:4px;font-size:11px;font-weight:800;color:#8a6d3b}.alz-rename-btn{margin-top:8px;border:1px solid #c7d6e6;background:#f3f8fd;color:#1d4570;border-radius:10px;padding:6px 12px;font-weight:900;font-size:12px;cursor:pointer}.alz-rename-form{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}.alz-rename-prefix{font-weight:900;font-size:1.1em;color:#1d4570;background:#eef4fa;border:1px solid #c7d6e6;border-radius:10px;padding:8px 10px}.alz-rename-form input{flex:1 1 140px;min-width:0;border:1px solid #c7d6e6;border-radius:10px;padding:8px 10px;font:inherit;font-weight:900;text-transform:uppercase}.alz-rename-msg{flex-basis:100%;font-size:12px;font-weight:800}.alz-rename-msg.err{color:#b3261e}.alz-rename-msg.ok{color:#12a150}</style>
<script id="alyzia-flight-rename-js">(function(){
if(window.__alyziaFlightRename)return;window.__alyziaFlightRename=true;
var ERR={NUMERO_INVALIDE:'Numéro invalide : il doit commencer par le code de la compagnie suivi de 1 à 5 lettres ou chiffres, dont au moins un chiffre.',NUMERO_DEJA_UTILISE:'Ce numéro existe déjà pour ce jour.',NUMERO_IDENTIQUE:'Le numéro est inchangé.',VOL_INTROUVABLE:'Vol introuvable sur le serveur.'};
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
function airlineOf(x){var a=String(x.airline||'').trim().toUpperCase(),fl=String(x.flight||'').trim().toUpperCase();return a&&fl.indexOf(a)===0?a:fl.replace(/\d.*$/,'')}
function suffixOf(x){var a=airlineOf(x);return String(x.flight||'').trim().toUpperCase().slice(a.length)}
function cleanSuffix(v){return String(v||'').toUpperCase().replace(/[^0-9A-Z]/g,'').slice(0,5)}
function openForm(x,item){
  var holder=item.querySelector('.alz-rename-slot');if(!holder||holder.firstChild)return;
  var air=airlineOf(x);
  holder.innerHTML='<div class="alz-rename-form"><span class="alz-rename-prefix">'+esc(air)+'</span><input type="text" inputmode="text" maxlength="5" autocomplete="off" value="'+esc(suffixOf(x))+'" aria-label="Numéro du vol (lettres et chiffres, au moins un chiffre)" placeholder="579, 579A, 9ZW"><button type="button" class="alz-rename-btn" data-act="ok">ENREGISTRER</button><button type="button" class="alz-rename-btn" data-act="no">ANNULER</button><div class="alz-rename-msg">Lettres et chiffres, au moins un chiffre (ex. 579, 579A, 9ZW). Le code compagnie ne change pas.</div></div>';
  var input=holder.querySelector('input'),msg=holder.querySelector('.alz-rename-msg'),ok=holder.querySelector('[data-act=ok]'),no=holder.querySelector('[data-act=no]');
  input.focus();input.select();
  input.addEventListener('input',function(){var v=cleanSuffix(input.value);if(v!==input.value)input.value=v});
  ok.onclick=function(){var v=cleanSuffix(input.value);if(!/^(?=.*[0-9])[0-9A-Z]{1,5}$/.test(v)){msg.className='alz-rename-msg err';msg.textContent='Saisis 1 à 5 lettres ou chiffres, dont au moins un chiffre (ex. 579, 579A, 9ZW).';return}save(x,air+v,msg,ok)};
  no.onclick=function(){holder.innerHTML=''};
  input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();ok.click()}});
}
var ERR2={LIEN_INVALIDE:'Lien non reconnu : colle l\u2019adresse de la page du vol sur flightradar24.com (elle se termine par 8 caractères, ex. /ENT9ZW/420b0f1c).',VOL_INTROUVABLE:'Vol introuvable sur le serveur.'};
async function saveLink(x,link,msg,btn,item){
  msg.className='alz-rename-msg';msg.textContent='ENREGISTREMENT…';btn.disabled=true;
  try{
    var r=await fetch(apiUrl('/api/flights/fr24-link'),{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({identity:identityOf(x),link:link})});
    var j=await r.json().catch(function(){return {}});
    if(r.ok&&j.ok){x.fr24OccurrenceId=j.fr24OccurrenceId;x.fr24OccurrenceIdSource='MANUAL';msg.className='alz-rename-msg ok';msg.textContent='LIEN ENREGISTRÉ ('+j.fr24OccurrenceId+') · FR24 sera lu au prochain passage (2 min).';var b=item.querySelector('b');if(b)b.textContent=j.fr24OccurrenceId;btn.disabled=false;return}
    msg.className='alz-rename-msg err';msg.textContent=ERR2[j.error]||j.detail||('Échec ('+(j.error||r.status)+')');
  }catch(e){msg.className='alz-rename-msg err';msg.textContent='Échec : serveur injoignable.'}
  btn.disabled=false;
}
function openLinkForm(x,item){
  var holder=item.querySelector('.alz-fr24-slot');if(!holder||holder.firstChild)return;
  holder.innerHTML='<div class="alz-rename-form"><input type="text" inputmode="url" autocomplete="off" placeholder="https://www.flightradar24.com/ENT9ZW/420b0f1c" aria-label="Lien FR24 du vol" style="text-transform:none"><button type="button" class="alz-rename-btn" data-act="ok">ENREGISTRER</button><button type="button" class="alz-rename-btn" data-act="no">ANNULER</button><div class="alz-rename-msg">Colle l\u2019adresse de la page du vol sur flightradar24.com.</div></div>';
  var input=holder.querySelector('input'),msg=holder.querySelector('.alz-rename-msg'),ok=holder.querySelector('[data-act=ok]'),no=holder.querySelector('[data-act=no]');
  input.focus();
  ok.onclick=function(){var v=input.value.trim();if(!v){msg.className='alz-rename-msg err';msg.textContent='Colle le lien FR24 du vol.';return}saveLink(x,v,msg,ok,item)};
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
  var fr=document.createElement('div');fr.className='flight-info-item alz-fr24link';
  fr.innerHTML='<small>LIEN FR24 DU VOL</small><b>'+esc(x.fr24OccurrenceId||'—')+'</b>'+(x.fr24OccurrenceIdSource==='MANUAL'?'<div class="alz-rename-note">SAISI À LA MAIN</div>':'')+'<button type="button" class="alz-rename-btn" data-act="link">COLLER LE LIEN FR24</button><div class="alz-fr24-slot"></div>';
  grid.insertBefore(fr,item.nextSibling);
  fr.querySelector('[data-act=link]').onclick=function(){openLinkForm(x,fr)};
}
function wrap(){
  var o=window.openFlightInfo;if(typeof o!=='function'||o.__alzRename)return false;
  var w=function(){var r=o.apply(this,arguments);setTimeout(inject,0);setTimeout(inject,120);return r};w.__alzRename=true;window.openFlightInfo=w;return true;
}
if(!wrap()){var n=0,t=setInterval(function(){if(wrap()||++n>40)clearInterval(t)},250)}
})();</script>`;
