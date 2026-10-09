import app from "./v2-exact-occurrence-wrapper.js";

// ADMIN ergonomics layered on the existing dashboard: 10 flights per page, the public sources table on its own page,
// no flash of the legacy API sections while loading, and "next processing" lines that name the public sources.
const UI=String.raw`<style id="alyzia-admin-ux-css">
#app .admin-native .adn-table tbody tr.adx-off{display:none!important}
#app .admin-native .adn-section.adx-src{display:none}
@media(min-width:900px){#app .admin-native .adn-cards{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
#app .admin-native.adx-sources.adx-anc>:not(.adx-anc):not(.adx-src):not(.adx-srchead),#app .admin-native.adx-sources .adx-anc>:not(.adx-anc):not(.adx-src):not(.adx-srchead){display:none!important}
#app .admin-native.adx-sources .adx-src,#app .admin-native.adx-sources .adx-anc{display:block}
.adx-pager{display:flex;align-items:center;justify-content:center;gap:10px;margin:12px 0 4px;flex-wrap:wrap}
.adx-pager button{min-height:36px;min-width:36px;padding:6px 12px;border:1px solid #bad2eb;border-radius:10px;background:#fff;color:#086bd5;font-weight:900;cursor:pointer}
.adx-pager button[disabled]{opacity:.4;cursor:default}.adx-pager button.on{background:#086bd5;color:#fff;border-color:#086bd5}
.adx-pager span{font-size:11px;font-weight:900;color:#536d87}
.adx-srcbtn{margin-left:8px;min-height:36px;padding:6px 14px;border:1px solid #bad2eb;border-radius:10px;background:#fff;color:#086bd5;font-weight:900;cursor:pointer}
.adx-cron{display:inline-flex;align-items:center;gap:6px;margin-left:8px;min-height:36px;padding:6px 12px;border:1px solid #cfe3f6;border-radius:10px;background:#f4f9ff;font-size:11px;font-weight:900;color:#536d87}.adx-cron b{font-size:15px;color:#086bd5;font-variant-numeric:tabular-nums}.adx-cron.soon b{color:#0f8a5f}
.adx-srcs{display:flex;gap:3px;flex-wrap:wrap;cursor:pointer}.adx-p{display:inline-block;min-width:26px;text-align:center;padding:2px 5px;border-radius:7px;font-size:9px;font-weight:950;letter-spacing:.02em;border:1px solid transparent}
.adx-p.ok{background:#e1f6ec;color:#0f8a5f;border-color:#bfe6d3}.adx-p.block{background:#ffe9d6;color:#b25400;border-color:#f6cba3}.adx-p.none{background:#eef2f6;color:#6b7c90;border-color:#dbe3ec}.adx-p.err{background:#ffe3e7;color:#c0213a;border-color:#f5bcc5}
.adx-health{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 4px}.adx-h{border:1px solid #dfe9f2;border-radius:10px;padding:6px 10px;background:#fbfdff;font-size:11px;font-weight:900;color:#536d87}.adx-h b{color:#10233f}.adx-h .g{color:#0f8a5f}.adx-h .o{color:#b25400}.adx-h .r{color:#c0213a}
.adx-add{margin-top:3px;font-size:11px;line-height:1.5;color:#35506f}.adx-add.none{color:#8a97a6;font-style:italic}.adx-c{display:inline-block;margin:0 8px 2px 0}.adx-c small{color:#6b7c90;font-weight:700}
.adx-sub td{padding-top:2px;padding-bottom:2px;font-size:11.5px;border-bottom:1px dashed #eef2f6}.adx-scroll{overflow-x:auto}.adx-nil{color:#8a97a6}.adx-t{white-space:nowrap;font-variant-numeric:tabular-nums}.adx-modal td{word-break:break-word}.adx-modal table{table-layout:fixed;min-width:560px;width:100%;border-collapse:collapse;font-size:12px}.adx-modal th,.adx-modal td{padding:7px 8px;border-bottom:1px solid #e4ebf2;text-align:left;vertical-align:top}.adx-modal th{font-size:10px;color:#6b7c90}.adx-modal .miss{margin:10px 0;font-weight:900;font-size:12px}
.adx-srchead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0 14px}.adx-srchead b{font-size:22px;font-weight:950;color:#10233f}
</style><script id="alyzia-admin-ux-js">(()=>{'use strict';
if(window.__alyziaAdminUx)return;window.__alyziaAdminUx=true;
const PAGE=10,LEGACY=/QUOTAS?\s*API|PROVIDER|FOURNISSEUR/i,LEGACY_NAMES=/(AIRLABS|SKYLINK|OAG|AERODATABOX|OPENSKY|QUARK|AVIATIONDATA|SERPAPI|FR24API|FR24DEP|CDGBOARD|KAYAK|FLIGHTERA|FLIGHTRADAR\d)[A-Z0-9 \/→·+]*$/;
let page=1,sig='',view='main',queued=false;
const root=()=>document.querySelector('#app .admin-native');
const rows=r=>[...r.querySelectorAll('.adn-table tbody tr')];

const SRC=[['FLIGHTSTATS','FS','FlightStats'],['FR24','FR','FlightRadar24'],['FR24BOARD','TB','FR24 tableau CDG'],['FIDS','FD','FIDS flightradar.live'],['GATENAVO','GN','Gatenavo (embarquement)'],['FLIGHTAWARE','FA','FlightAware']];
const LAB={OK:'Lu avec succès',COOLDOWN:'En pause (limite atteinte récemment)',BLOCKED:'Bloqué par le site',NO_USABLE_DATA:'Page lue, aucune donnée utile',NOT_TRACKED:'Vol non suivi par cette source',NO_OCCURRENCE_URL:'Pas de page pour ce jour',FR24_NO_USABLE_DATA:'Aucune donnée exploitable',TIMEOUT:'Délai dépassé',FETCH_ERROR:'Erreur réseau',OCCURRENCE_MISMATCH:'Autre jour du même vol',HTTP_ERROR:'Erreur du site',NO_SOURCE:'Source non utilisée'};
function kind(a){if(!a)return 'none';if(a.st==='OK')return 'ok';if(a.h===403||a.h===429||a.st==='BLOCKED'||a.st==='COOLDOWN')return 'block';if(/NO_USABLE|NOT_TRACKED|NO_OCCURRENCE|NO_SOURCE|MISMATCH/.test(a.st))return 'none';return 'err'}
function label(a){let t=LAB[a.st]||a.st;if(a.h===403)t='Refusé (403) : trop de requêtes ou blocage';else if(a.h===429)t='Trop de requêtes (429) : patienter';else if(a.h&&a.st==='HTTP_ERROR')t='Erreur du site (HTTP '+a.h+')';return t}
const hm=iso=>{const d=new Date(iso);return Number.isFinite(d.getTime())?d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'—'};
const esc=v=>String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let refDate='',flightsCache=null,flightsAt=0,loading=false;
let pausesCache=[],pausesAt=0;
function loadPauses(){if(Date.now()-pausesAt<30000)return;pausesAt=Date.now();fetch('/api/admin/pauses',{cache:'no-store'}).then(r=>r.json()).then(d=>{if(d&&d.ok){pausesCache=d.pauses||[];queue()}}).catch(()=>{})}
const hmClock=iso=>{const d=new Date(iso);return Number.isFinite(d.getTime())?d.toLocaleTimeString('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}):''};
function pauseNote(key){const p=pausesCache.find(x=>x.key===key&&Date.parse(x.until)>Date.now());if(!p)return '';const range=p.waiting>1&&p.from&&hmClock(p.from)!==hmClock(p.until)?'de '+hmClock(p.from)+' à '+hmClock(p.until):'vers '+hmClock(p.until);return ' <small style="color:#8a6d3b;font-weight:800" title="'+esc(p.note||'')+'">· reprise '+range+' (dans '+Math.max(1,Math.ceil((Date.parse(p.from&&p.waiting>1?p.from:p.until)-Date.now())/60000))+' min)</small>'}
function loadFlights(){if(loading||Date.now()-flightsAt<15000)return;loading=true;loadPauses();fetch('/api/admin/flight-processing',{cache:'no-store'}).then(r=>r.json()).then(d=>{if(d&&d.ok){flightsCache=d.flights||[];refDate=d.date||'';flightsAt=Date.now();queue()}}).catch(()=>{}).finally(()=>{loading=false})}
function find(flight,date){return (flightsCache||[]).find(x=>x.flight===flight&&x.date===date)}
function latest(x,key){return (x.attempts||[]).filter(a=>a.s===key).slice(-1)[0]}
// Dernière lecture « utile » pour le bilan : FlightAware ne concerne plus que les vols JU (les autres ne sont plus lus : ils n'entrent plus dans ses chiffres) ;
// un « en pause » ancien sans pause en cours n'est plus un refus actuel, le vol est simplement à relire (« non lu »).
const SRC_ONLY={FLIGHTAWARE:['JU']};
const pauseActive=key=>(typeof pausesCache!=='undefined'?pausesCache:[]).some(p=>p.key===key&&Date.parse(p.until)>Date.now());
function latestEff(x,key){const a=latest(x,key);if(!a)return a;const only=SRC_ONLY[key];if(only&&!only.includes(String(x.flight||'').replace(/\s+/g,'').slice(0,2).toUpperCase()))return undefined;if(a.st==='COOLDOWN'&&!pauseActive(key))return undefined;return a}
function pills(x){const by=contributions(x);return SRC.map(s=>{const a=latestEff(x,s[0]);let k=kind(a),t=a?label(a):'pas encore lu';if(k==='none'&&by[s[0]]&&by[s[0]].length){k='ok';t='a apporté '+by[s[0]].map(c=>c.f).join(', ')}return '<span class="adx-p '+k+'" title="'+esc(s[2]+' : '+t)+'">'+s[1]+'</span>'}).join('')}
// Qui a apporté quoi : dernière valeur de chaque champ écrite par chaque source, d'après le journal du vol.
const FLD={etd:'ETD',atd:'ATD',eta:'ETA',ata:'ATA',takeoff:'TO',landing:'LDG',gate:'GATE',reg:'REG',aircraft:'A/C',status:'STATUT',boarding:'EMBARQ.'};
function srcKeyOf(src){const u=String(src||'').toUpperCase();if(u.includes('FR24BOARD'))return 'FR24BOARD';if(u.includes('GATENAVO'))return 'GATENAVO';if(u.includes('FIDS'))return 'FIDS'+(u.includes('ONTIME')?'':'');if(u.includes('FLIGHTSTATS'))return 'FLIGHTSTATS';if(u.includes('FLIGHTAWARE'))return 'FLIGHTAWARE';if(u.includes('PLANEFINDER'))return 'PLANEFINDER';if(u.includes('SKYSCANNER'))return 'SKYSCANNER';if(u.includes('FR24'))return 'FR24';return 'AUTRE'}
function contributions(x){const by={},seen={};(x.log||[]).forEach(e=>{const k=srcKeyOf(e.s),f=String(e.f||'').toLowerCase();if(!FLD[f]||!e.to)return;const id=k+'|'+f;if(seen[id])return;seen[id]=1;(by[k]=by[k]||[]).push({f:FLD[f],v:e.to,at:e.at,s:e.s,onTime:/ONTIME/i.test(e.s||''),derived:/DERIVED/i.test(e.s||'')})});return by}
function contribHtml(list){return list.map(c=>'<span class="adx-c"><b>'+esc(c.f)+'</b> '+esc(c.v)+' <small>'+hm(c.at)+(c.onTime?' · à l\'heure (estimé = prévu)':'')+(c.derived?' · calculé':'')+'</small></span>').join('')}
function openDetail(x){
  const by=contributions(x);
  const dash='<span class="adx-nil">—</span>';
  // Une ligne par source (statut de la dernière lecture), puis une sous-ligne par information apportée : valeur | précision | heure d'écriture.
  const subs=list=>(list||[]).map(c=>'<tr class="adx-sub"><td></td><td></td><td><b>'+esc(c.f)+'</b></td><td>'+esc(c.v)+(c.onTime?' <small class="adx-nil">à l\'heure (estimé = prévu)</small>':c.derived?' <small class="adx-nil">calculé</small>':'')+'</td><td class="adx-t">'+hm(c.at)+'</td></tr>').join('');
  const lastAt=(a,c)=>[a&&a.at,...(c||[]).map(v=>v.at)].filter(Boolean).sort().slice(-1)[0];
  const rows=SRC.map(s=>{const a=latest(x,s[0]);const c=by[s[0]];const head=(pill,det,at,add)=>'<tr><td><b>'+s[2]+'</b></td><td>'+pill+'</td><td>'+add+'</td><td>'+det+'</td><td class="adx-t">'+(at?hm(at):'—')+'</td></tr>';
    if(!a&&!c)return head('<span class="adx-p none">PAS LU</span>',dash,'',dash);
    const k=a?kind(a):'ok',pill='<span class="adx-p '+k+'">'+(k==='ok'?(a?'OK':'A APPORTÉ'):k==='block'?'LIMITÉ':k==='none'?'VIDE':'ERREUR')+'</span> '+(a?esc(label(a)):'');
    return head(pill,esc(a&&a.d||'—'),lastAt(a,c),c?'<span class="adx-nil">'+c.length+' info'+(c.length>1?'s':'')+' ↓</span>':'<span class="adx-nil">Rien apporté</span>')+subs(c)}).join('')+(by.AUTRE?'<tr><td><b>Autres</b></td><td>'+dash+'</td><td><span class="adx-nil">'+by.AUTRE.length+' info(s) ↓</span></td><td>'+dash+'</td><td>'+dash+'</td></tr>'+subs(by.AUTRE):'');
  const lastAll=(x.attempts||[]).map(a=>a.at).concat(Object.values(by).flat().map(c=>c.at)).filter(Boolean).sort().slice(-1)[0];
  const html='<div class="adx-modal"><div class="miss">'+(x.missing&&x.missing.length?'Manque : '+esc(x.missing.join(', ')):'Rien ne manque')+' · dernière lecture '+hm(x.liveAt||lastAll)+'</div><div class="adx-scroll"><table><colgroup><col style="width:19%"><col style="width:17%"><col style="width:28%"><col style="width:26%"><col style="width:10%"></colgroup><thead><tr><th>SOURCE</th><th>RÉSULTAT</th><th>A APPORTÉ</th><th>DÉTAIL</th><th>HEURE</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
  if(typeof showModal==='function')showModal(x.flight+' · lectures des sources',x.date,html);
}
// Détail d'une puce du bilan : tous les vols du jour affiché rangés par résultat de la dernière lecture de cette source.
function openSourceList(key){
  const def=SRC.find(s=>s[0]===key);if(!def)return;
  const date=document.getElementById('adminDateInput')?.value||'';
  const flights=(flightsCache||[]).filter(x=>x.date===date).slice().sort((a,b)=>String(a.std||'').localeCompare(String(b.std||'')));
  const cats={err:{t:'ERREUR',l:[]},block:{t:'REFUSÉS / EN PAUSE',l:[]},none:{t:'SANS DONNÉE',l:[]},unread:{t:'NON LUS',l:[]},old:{t:'ANCIENNES TENTATIVES (plus relus depuis 45 min)',l:[]},ok:{t:'LUS',l:[]}};
  flights.forEach(x=>{if(SRC_ONLY[key]&&!SRC_ONLY[key].includes(String(x.flight||'').replace(/\s+/g,'').slice(0,2).toUpperCase()))return;const a=latestEff(x,key),c=(contributions(x)[key]||[]);
    if(!a&&!c.length)return cats.unread.l.push({x,a:null,c});
    let k=a?kind(a):'ok';if(k==='none'&&c.length)k='ok';if(k==='block'&&staleBlock(a))k='old';(cats[k]||cats.ok).l.push({x,a,c})});
  const dash='<span class="adx-nil">—</span>';
  const row=e=>{const a=e.a,why=a?esc(label(a)+(a.d?' · '+a.d:'')+(a.h?' · HTTP '+a.h:'')):(e.c.length?'a apporté '+esc(e.c.map(v=>v.f).join(', ')):'pas encore lu'),at=(a&&a.at)||(e.c[0]&&e.c[0].at)||'';
    return '<tr><td><b>'+esc(e.x.flight)+'</b></td><td>'+esc(e.x.std||'')+'</td><td>'+esc(e.x.destination||'')+'</td><td>'+esc(e.x.flightStatus||'')+'</td><td>'+why+'</td><td class="adx-t">'+(at?hm(at):'—')+'</td></tr>'};
  const sec=(k,open)=>{const c=cats[k];if(!c.l.length)return '';return '<details'+(open?' open':'')+' style="margin:8px 0"><summary style="cursor:pointer;font-weight:900;padding:6px 0"><span class="adx-p '+(k==='unread'||k==='old'?'none':k)+'">'+c.t+'</span> '+c.l.length+' vol'+(c.l.length>1?'s':'')+'</summary><div class="adx-scroll"><table><colgroup><col style="width:14%"><col style="width:9%"><col style="width:9%"><col style="width:16%"><col style="width:44%"><col style="width:8%"></colgroup><thead><tr><th>VOL</th><th>STD</th><th>DEST</th><th>STATUT</th><th>DÉTAIL</th><th>HEURE</th></tr></thead><tbody>'+c.l.map(row).join('')+'</tbody></table></div></details>'};
  const html='<div class="adx-modal"><div class="miss">'+flights.length+' vols du '+esc(date)+' · '+Object.keys(cats).map(k=>cats[k].t+' '+cats[k].l.length).join(' · ')+'</div>'+sec('err',true)+sec('block',true)+sec('none',false)+sec('unread',false)+sec('old',false)+sec('ok',false)+'</div>';
  if(typeof showModal==='function')showModal(def[2]+' · détail du bilan',date,html);
}
window.alzAdminSourceList=openSourceList;
document.addEventListener('click',e=>{const el=e.target&&e.target.closest&&e.target.closest('.adx-hsrc');if(!el)return;e.preventDefault();openSourceList(el.getAttribute('data-adx-src'))});
function decorate(r){
  const table=r.querySelector('.adn-table');if(!table||!flightsCache)return;
  const heads=[...table.querySelectorAll('thead th')].map(t=>t.textContent.trim().toUpperCase()),col=heads.indexOf('DERNIER TRAITEMENT');if(col<0)return;
  const date=document.getElementById('adminDateInput')?.value||'';
  rows(r).forEach(tr=>{const cell=tr.cells[col],fl=(tr.cells[0]?.textContent||'').trim();if(!cell||!fl)return;const x=find(fl,date);if(!x)return;
    // Un vol pas encore lu par aucune source (jour suivant, vol récent) garde ses pastilles, en gris « pas encore lu », avec son dernier traitement connu.
    const att=x.attempts||[],sig=x.liveAt+'|'+((x.log||[]).length)+'|'+att.map(a=>a.s+a.st+a.h+a.d).join(',');if(cell.dataset.adxSig===sig&&cell.querySelector('.adx-srcs'))return;cell.dataset.adxSig=sig;
    if(!cell.querySelector('.adx-srcs'))cell.dataset.adxOrig=cell.textContent.replace(/\s+/g,' ').trim();
    const last=att.length?hm(x.liveAt):(cell.dataset.adxOrig||'—');
    cell.innerHTML='<div class="adx-srcs" title="Cliquer pour le détail">'+pills(x)+'</div><div style="font-size:10px;color:#6b7c90;font-weight:800;margin-top:2px">'+esc(last)+'</div>';
    cell.querySelector('.adx-srcs').addEventListener('click',e=>{e.stopPropagation();e.preventDefault();openDetail(x)},true)});
  health(r,table,date);
}
// Une tentative refusée / en pause vieille de plus de 45 min n'est plus un refus en cours : le vol n'est simplement plus relu (vol arrivé, hors file). Elle n'est plus comptée dans « refusés / en pause ».
function staleBlock(a){return Boolean(a&&a.at&&Date.now()-Date.parse(a.at)>45*60000)}
function health(r,table,date){
  let bar=r.querySelector('.adx-health:not(.adx-health-copy)');const cards=r.querySelector('.adn-cards');
  if(!bar){bar=document.createElement('div');bar.className='adx-health';if(cards&&cards.parentElement)cards.parentElement.insertBefore(bar,cards.nextSibling);else table.parentElement.insertBefore(bar,table)}
  else if(cards&&cards.parentElement&&bar.previousElementSibling!==cards)cards.parentElement.insertBefore(bar,cards.nextSibling);
  const list=(flightsCache||[]).filter(x=>x.date===date&&((x.attempts&&x.attempts.length)||(x.log&&x.log.length&&Object.keys(contributions(x)).length))),dl=/^\d{4}-\d{2}-\d{2}$/.test(date||'')?date.slice(8)+'/'+date.slice(5,7):'';
  const html='<span class="adx-h adx-date" title="Bilan des lectures du jour affiché dans le tableau"><b>BILAN '+esc(dl)+'</b></span>'+(list.length?SRC.map(s=>{let ok=0,bl=0,no=0,er=0,old=0;const why={};list.forEach(x=>{const a=latestEff(x,s[0]);if(!a){const c=contributions(x)[s[0]];if(c&&c.length)ok++;return}let k=kind(a);if(k==='none'&&(contributions(x)[s[0]]||[]).length)k='ok';if(k==='ok')ok++;else if(k==='block'&&staleBlock(a)){old++}else if(k==='block'){bl++;const w=a.h===403?'403 refusé':a.h===429?'429 trop de requêtes':a.st==='COOLDOWN'?'pause automatique':(a.st==='BLOCKED'?'page de blocage':'autre');why[w]=(why[w]||0)+1}else if(k==='none')no++;else er++});const wh=Object.keys(why).map(k=>why[k]+' '+k).join(', ');
    const det={};if(s[0]==='FLIGHTSTATS')list.forEach(x=>{const a=latest(x,'FLIGHTSTATS');const d=a&&a.d||'';let k='';if(/API OK/.test(d))k='API lue';else if(/API HTTP (\d+)/.test(d))k='API '+d.match(/API HTTP (\d+)/)[1];else if(/NO_FLIGHT_ID/.test(d))k='sans identifiant';else if(/PAGE OK/.test(d))k='page détail lue';if(k)det[k]=(det[k]||0)+1});const dt=Object.keys(det).map(k=>det[k]+' '+k).join(', ');let stale='';if(s[0]==='FIDS'){let last=0;list.forEach(x=>{const a=latest(x,'FIDS');const t=a&&Date.parse(a.at);if(t>last)last=t});const age=last?Math.round((Date.now()-last)/60000):0;if(last&&age>30)stale=' <span class="r" title="Le flux FIDS garde ~3 h de départs : sans lecture, les ATD des vols qui partent sont perdus">⚠ pas lu depuis '+age+' min</span>'}const part=[ok?'<span class="g">'+ok+' lus</span>':'',bl?'<span class="o" title="'+esc(wh)+'">'+bl+' refusés / en pause</span> <small style="color:#8a6d3b;font-weight:800">('+esc(wh)+')</small>':'',no?no+' sans donnée':'',old?'<span title="Dernière tentative refusée il y a plus de 45 min : ces vols ne sont plus relus" style="color:#8a6d3b">'+old+' anciennes tentatives</span>':'',er?'<span class="r">'+er+' en erreur</span>':''].filter(Boolean).join(' · ')||'pas encore lu';return '<span class="adx-h adx-hsrc" data-adx-src="'+s[0]+'" style="cursor:pointer" title="Dernière lecture de chaque vol du jour ('+list.length+' vols) · cliquer pour la liste des vols par résultat"><b>'+s[2]+'</b> '+part+(dt?' <small style="color:#53708f;font-weight:800">· heures de porte : '+esc(dt)+'</small>':'')+stale+pauseNote(s[0])+'</span>'}).join(''):'<span class="adx-h">Aucune lecture enregistrée pour ce jour</span>');
  if(bar.dataset.k!==html){bar.dataset.k=html;bar.innerHTML=html}
  // La même bande de bilan, au-dessus des en-têtes du tableau de la page SOURCES PUBLIQUES (elle y est recréée à chaque rafraîchissement de la page).
  {const wrap=r.querySelector('.adx-src .ps-table-wrap');if(wrap&&wrap.parentElement){let copy=wrap.parentElement.querySelector('.adx-health-copy');if(!copy){copy=document.createElement('div');copy.className='adx-health adx-health-copy';wrap.parentElement.insertBefore(copy,wrap)}if(copy.dataset.k!==html){copy.dataset.k=html;copy.innerHTML=html}}}
}
function cards(r){
  if(!flightsCache||!flightsCache.length)return;
  const cs=[...r.querySelectorAll('.adn-cards .adn-card')];if(cs.length<3)return;
  const ref=refDate;if(!ref)return;
  const groups=[x=>x.date===ref,x=>x.date>ref,x=>x.date<ref];
  cs.slice(0,3).forEach((c,i)=>{const l=flightsCache.filter(groups[i]);const n=st=>l.filter(x=>st(String(x.state||''))).length;
    const set=(cls,t)=>{const el=c.querySelector('.adn-mini .'+cls);if(el&&el.textContent!==t)el.textContent=t};
    const b=c.querySelector(':scope>b');const tt=(b?.textContent||'').split('·')[0].trim();if(b&&l.length){const nt=tt+' · '+l.length;if(b.textContent!==nt)b.textContent=nt}
    if(!l.length)return;set('ok','OK '+n(v=>v==='OK'));set('part','EN ATTENTE '+n(v=>v==='EN ATTENTE'));set('check','À CONTRÔLER '+n(v=>v.includes('CONTRÔLER')));set('none','NON TRAITÉ '+n(v=>v==='NON TRAITÉ'))});
}
function tidy(r){
  r.querySelectorAll('.adn-section').forEach(sec=>{
    const h=(sec.querySelector(':scope>h3')?.textContent||'').trim();
    if(/SOURCES PUBLIQUES/i.test(h)){if(!sec.classList.contains('adx-src'))sec.classList.add('adx-src');return}
    if(LEGACY.test(h))sec.remove();
  });
  r.querySelectorAll('.adn-card-next').forEach(el=>{const t=el.textContent||'',n=t.replace(LEGACY_NAMES,'FLIGHTSTATS · FR24 · FLIGHTAWARE');if(n!==t)el.textContent=n});
}
function cronLeft(){const n=new Date(),s=(120-((n.getUTCMinutes()%2)*60+n.getUTCSeconds()))%120||120;return s}
function cronText(){const s=cronLeft();return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function tickCron(){document.querySelectorAll('.adx-cron').forEach(el=>{const b=el.querySelector('b'),t=cronText();if(b&&b.textContent!==t)b.textContent=t;el.classList.toggle('soon',cronLeft()<=10)})}
function controls(r){
  const head=r.querySelector('.adn-head');
  if(head&&!head.querySelector('.adx-cron')){const c=document.createElement('span');c.className='adx-cron';c.title='Le contrôle automatique des vols passe toutes les 2 minutes (minutes paires)';c.innerHTML='PROCHAIN PASSAGE <b>--:--</b>';const ref=head.querySelector('.adx-srcbtn');(ref?.parentNode||head).insertBefore(c,ref||null);tickCron()}
  if(head&&!head.querySelector('.adx-srcbtn')){
    const b=document.createElement('button');b.type='button';b.className='adx-srcbtn';b.textContent='SOURCES PUBLIQUES';b.addEventListener('click',()=>setView('sources'));
    const refresh=head.querySelector('.adn-refresh,#adminRefreshBtn');(refresh?.parentNode||head).appendChild(b);
  }
  let bar=r.querySelector('.adx-srchead');
  if(!bar){bar=document.createElement('div');bar.className='adx-srchead';bar.innerHTML='<button type="button" class="adx-srcbtn" style="margin:0">‹ RETOUR ADMIN</button><b>SOURCES PUBLIQUES</b><span></span>';bar.querySelector('button').addEventListener('click',()=>setView('main'));r.insertBefore(bar,r.firstChild)}
  bar.style.display=view==='sources'?'flex':'none';
  r.classList.toggle('adx-sources',view==='sources');
  // The sources table may sit inside another block (it is moved around by older scripts): keep the whole chain from the table up to the page visible.
  r.querySelectorAll('.adx-anc').forEach(e=>{if(view!=='sources')e.classList.remove('adx-anc')});
  if(view==='sources'){const sec=r.querySelector('.adx-src');if(sec){r.classList.add('adx-anc');for(let e=sec.parentElement;e&&e!==r;e=e.parentElement)e.classList.add('adx-anc')}}
}
function paginate(r){
  const table=r.querySelector('.adn-table');if(!table)return;
  const all=rows(r).filter(tr=>tr.style.display!=='none');
  const s=all.length+'|'+(all[0]?.textContent||'').slice(0,40);
  if(s!==sig){sig=s;page=1}
  const pages=Math.max(1,Math.ceil(all.length/PAGE));if(page>pages)page=pages;
  const keep=new Set(all.slice((page-1)*PAGE,page*PAGE));
  const badge=r.querySelector('.flight-count-badge'),bt=all.length+' VOL'+(all.length>1?'S':'');if(badge&&badge.textContent!==bt)badge.textContent=bt;
  rows(r).forEach(tr=>{const off=!keep.has(tr)&&tr.style.display!=='none';if(tr.classList.contains('adx-off')!==off)tr.classList.toggle('adx-off',off)});
  const holder=table.closest('.adn-section')||table.parentElement;
  let bar=holder.querySelector('.adx-pager');if(!bar){bar=document.createElement('div');bar.className='adx-pager';holder.appendChild(bar)}
  const key=page+'/'+pages+'/'+all.length;if(bar.dataset.k===key)return;bar.dataset.k=key;
  let nums='';for(let i=1;i<=pages;i++){if(i===1||i===pages||Math.abs(i-page)<=1)nums+='<button type="button" data-p="'+i+'" class="'+(i===page?'on':'')+'">'+i+'</button>';else if(Math.abs(i-page)===2)nums+='<span>…</span>'}
  bar.innerHTML='<button type="button" data-p="'+(page-1)+'"'+(page<=1?' disabled':'')+'>‹</button>'+nums+'<button type="button" data-p="'+(page+1)+'"'+(page>=pages?' disabled':'')+'>›</button><span>'+all.length+' VOL'+(all.length>1?'S':'')+' · PAGE '+page+'/'+pages+'</span>';
  bar.querySelectorAll('button[data-p]').forEach(b=>b.addEventListener('click',()=>{const n=Number(b.dataset.p);if(n>=1&&n<=pages){page=n;bar.dataset.k='';run()}}));
}
function setView(v){view=v;const r=root();if(r){controls(r);try{window.scrollTo(0,0)}catch{}}}
function run(){queued=false;const r=root();if(!r){view='main';return}try{tidy(r);controls(r);paginate(r);loadFlights();decorate(r);cards(r)}catch(e){console.error('admin ux',e)}}
function queue(){if(queued)return;queued=true;requestAnimationFrame(run)}
const app=document.getElementById('app');
if(app)new MutationObserver(queue).observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
setInterval(run,1200);setInterval(tickCron,1000);
})();</script>`;

function patch(html){
  let s=String(html||"").replace(/<style id="alyzia-admin-ux-css">[\s\S]*?<\/style>/g,"").replace(/<script id="alyzia-admin-ux-js">[\s\S]*?<\/script>/g,"");
  const i=s.lastIndexOf("</body>");
  return i>=0?s.slice(0,i)+UI+"\n"+s.slice(i):s+UI;
}

export default {
  async fetch(request,env,ctx){
    const r=await app.fetch(request,env,ctx);
    const type=String(r.headers.get("content-type")||"").toLowerCase();
    if(!type.includes("text/html"))return r;
    const h=new Headers(r.headers);h.delete("content-length");h.set("cache-control","no-store");
    return new Response(patch(await r.text()),{status:r.status,statusText:r.statusText,headers:h});
  },
  scheduled(controller,env,ctx){if(typeof app.scheduled==="function")return app.scheduled(controller,env,ctx)}
};
