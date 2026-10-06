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
.adx-modal table{width:100%;border-collapse:collapse;font-size:12px}.adx-modal th,.adx-modal td{padding:7px 8px;border-bottom:1px solid #e4ebf2;text-align:left;vertical-align:top}.adx-modal th{font-size:10px;color:#6b7c90}.adx-modal .miss{margin:10px 0;font-weight:900;font-size:12px}
.adx-srchead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0 14px}.adx-srchead b{font-size:22px;font-weight:950;color:#10233f}
</style><script id="alyzia-admin-ux-js">(()=>{'use strict';
if(window.__alyziaAdminUx)return;window.__alyziaAdminUx=true;
const PAGE=10,LEGACY=/QUOTAS?\s*API|PROVIDER|FOURNISSEUR/i,LEGACY_NAMES=/(AIRLABS|SKYLINK|OAG|AERODATABOX|OPENSKY|QUARK|AVIATIONDATA|SERPAPI|FR24API|FR24DEP|CDGBOARD|KAYAK|FLIGHTERA|FLIGHTRADAR\d)[A-Z0-9 \/→·+]*$/;
let page=1,sig='',view='main',queued=false;
const root=()=>document.querySelector('#app .admin-native');
const rows=r=>[...r.querySelectorAll('.adn-table tbody tr')];

const SRC=[['FLIGHTSTATS','FS','FlightStats'],['FR24','FR','FlightRadar24'],['FR24BOARD','TB','FR24 tableau CDG'],['FIDS','FD','FIDS flightradar.live'],['FLIGHTAWARE','FA','FlightAware'],['PLANEFINDER','PF','PlaneFinder'],['SKYSCANNER','SK','Skyscanner']];
const LAB={OK:'Lu avec succès',COOLDOWN:'En pause (limite atteinte récemment)',BLOCKED:'Bloqué par le site',NO_USABLE_DATA:'Page lue, aucune donnée utile',NOT_TRACKED:'Vol non suivi par cette source',NO_OCCURRENCE_URL:'Pas de page pour ce jour',FR24_NO_USABLE_DATA:'Aucune donnée exploitable',TIMEOUT:'Délai dépassé',FETCH_ERROR:'Erreur réseau',OCCURRENCE_MISMATCH:'Autre jour du même vol',HTTP_ERROR:'Erreur du site',NO_SOURCE:'Source non utilisée'};
function kind(a){if(!a)return 'none';if(a.st==='OK')return 'ok';if(a.h===403||a.h===429||a.st==='BLOCKED'||a.st==='COOLDOWN')return 'block';if(/NO_USABLE|NOT_TRACKED|NO_OCCURRENCE|NO_SOURCE|MISMATCH/.test(a.st))return 'none';return 'err'}
function label(a){let t=LAB[a.st]||a.st;if(a.h===403)t='Refusé (403) : trop de requêtes ou blocage';else if(a.h===429)t='Trop de requêtes (429) : patienter';else if(a.h&&a.st==='HTTP_ERROR')t='Erreur du site (HTTP '+a.h+')';return t}
const hm=iso=>{const d=new Date(iso);return Number.isFinite(d.getTime())?d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):'—'};
const esc=v=>String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let refDate='',flightsCache=null,flightsAt=0,loading=false;
function loadFlights(){if(loading||Date.now()-flightsAt<15000)return;loading=true;fetch('/api/admin/flight-processing',{cache:'no-store'}).then(r=>r.json()).then(d=>{if(d&&d.ok){flightsCache=d.flights||[];refDate=d.date||'';flightsAt=Date.now();queue()}}).catch(()=>{}).finally(()=>{loading=false})}
function find(flight,date){return (flightsCache||[]).find(x=>x.flight===flight&&x.date===date)}
function latest(x,key){return (x.attempts||[]).filter(a=>a.s===key).slice(-1)[0]}
function pills(x){return SRC.map(s=>{const a=latest(x,s[0]);const k=kind(a);return '<span class="adx-p '+k+'" title="'+esc(s[2]+' : '+(a?label(a):'pas encore lu'))+'">'+s[1]+'</span>'}).join('')}
function openDetail(x){
  const rows=SRC.map(s=>{const a=latest(x,s[0]);if(!a)return '<tr><td><b>'+s[2]+'</b></td><td colspan="3">Pas encore lu pour ce vol</td></tr>';const k=kind(a);return '<tr><td><b>'+s[2]+'</b></td><td><span class="adx-p '+k+'">'+(k==='ok'?'OK':k==='block'?'LIMITÉ':k==='none'?'VIDE':'ERREUR')+'</span> '+esc(label(a))+'</td><td>'+esc(a.d||'—')+'</td><td>'+hm(a.at)+'</td></tr>'}).join('');
  const html='<div class="adx-modal"><div class="miss">'+(x.missing&&x.missing.length?'Manque : '+esc(x.missing.join(', ')):'Rien ne manque')+' · dernière lecture '+hm(x.liveAt)+'</div><table><thead><tr><th>SOURCE</th><th>RÉSULTAT</th><th>DÉTAIL</th><th>HEURE</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  if(typeof showModal==='function')showModal(x.flight+' · lectures des sources',x.date,html);
}
function decorate(r){
  const table=r.querySelector('.adn-table');if(!table||!flightsCache)return;
  const heads=[...table.querySelectorAll('thead th')].map(t=>t.textContent.trim().toUpperCase()),col=heads.indexOf('DERNIER TRAITEMENT');if(col<0)return;
  const date=document.getElementById('adminDateInput')?.value||'';
  rows(r).forEach(tr=>{const cell=tr.cells[col],fl=(tr.cells[0]?.textContent||'').trim();if(!cell||!fl)return;const x=find(fl,date);if(!x||!x.attempts||!x.attempts.length)return;
    const sig=x.liveAt+'|'+x.attempts.map(a=>a.s+a.st+a.h+a.d).join(',');if(cell.dataset.adxSig===sig&&cell.querySelector('.adx-srcs'))return;cell.dataset.adxSig=sig;
    cell.innerHTML='<div class="adx-srcs" title="Cliquer pour le détail">'+pills(x)+'</div><div style="font-size:10px;color:#6b7c90;font-weight:800;margin-top:2px">'+hm(x.liveAt)+'</div>';
    cell.querySelector('.adx-srcs').addEventListener('click',e=>{e.stopPropagation();e.preventDefault();openDetail(x)},true)});
  health(r,table,date);
}
function health(r,table,date){
  const holder=table.closest('.adn-section')||table.parentElement;let bar=holder.querySelector('.adx-health');if(!bar){bar=document.createElement('div');bar.className='adx-health';table.parentElement.insertBefore(bar,table)}
  const list=(flightsCache||[]).filter(x=>x.date===date&&x.attempts&&x.attempts.length);
  const html=list.length?SRC.map(s=>{let ok=0,bl=0,no=0,er=0;const why={};list.forEach(x=>{const a=latest(x,s[0]);if(!a)return;const k=kind(a);if(k==='ok')ok++;else if(k==='block'){bl++;const w=a.h===403?'403 refusé':a.h===429?'429 trop de requêtes':a.st==='COOLDOWN'?'pause automatique':(a.st==='BLOCKED'?'page de blocage':'autre');why[w]=(why[w]||0)+1}else if(k==='none')no++;else er++});const wh=Object.keys(why).map(k=>why[k]+' '+k).join(', ');
    const det={};if(s[0]==='FLIGHTSTATS')list.forEach(x=>{const a=latest(x,'FLIGHTSTATS');const d=a&&a.d||'';let k='';if(/API OK/.test(d))k='API lue';else if(/API HTTP (\d+)/.test(d))k='API '+d.match(/API HTTP (\d+)/)[1];else if(/NO_FLIGHT_ID/.test(d))k='sans identifiant';else if(/PAGE OK/.test(d))k='page détail lue';if(k)det[k]=(det[k]||0)+1});const dt=Object.keys(det).map(k=>det[k]+' '+k).join(', ');const part=[ok?'<span class="g">'+ok+' lus</span>':'',bl?'<span class="o" title="'+esc(wh)+'">'+bl+' refusés / en pause</span> <small style="color:#8a6d3b;font-weight:800">('+esc(wh)+')</small>':'',no?no+' sans donnée':'',er?'<span class="r">'+er+' en erreur</span>':''].filter(Boolean).join(' · ')||'pas encore lu';return '<span class="adx-h" title="Dernière lecture de chaque vol du jour ('+list.length+' vols)"><b>'+s[2]+'</b> '+part+(dt?' <small style="color:#53708f;font-weight:800">· heures de porte : '+esc(dt)+'</small>':'')+'</span>'}).join(''):'<span class="adx-h">Aucune lecture enregistrée pour ce jour</span>';
  if(bar.dataset.k!==html){bar.dataset.k=html;bar.innerHTML=html}
}
function cards(r){
  if(!flightsCache||!flightsCache.length)return;
  const cs=[...r.querySelectorAll('.adn-cards .adn-card')];if(cs.length<3)return;
  const ref=refDate;if(!ref)return;
  const groups=[x=>x.date===ref,x=>x.date>ref,x=>x.date<ref];
  cs.slice(0,3).forEach((c,i)=>{const l=flightsCache.filter(groups[i]);const n=st=>l.filter(x=>st(String(x.state||''))).length;
    const set=(cls,t)=>{const el=c.querySelector('.adn-mini .'+cls);if(el&&el.textContent!==t)el.textContent=t};
    const b=c.querySelector(':scope>b');const tt=(b?.textContent||'').split('·')[0].trim();if(b&&l.length){const nt=tt+' · '+l.length;if(b.textContent!==nt)b.textContent=nt}
    if(!l.length)return;set('ok','OK '+n(v=>v==='OK'));set('part','PARTIEL '+n(v=>v==='PARTIEL'));set('check','À CONTRÔLER '+n(v=>v.includes('CONTRÔLER')));set('none','NON TRAITÉ '+n(v=>v==='NON TRAITÉ'))});
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
