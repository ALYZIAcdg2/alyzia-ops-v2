import app from "./admin-dashboard-v2-wrapper.js";

const UI=String.raw`<style id="alyzia-admin-dashboard-v3-css">
#app .admin-native .adn-search-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 4px}
#app .admin-native .adn-search-box{display:flex;align-items:center;gap:8px;min-width:min(420px,100%);flex:1;border:1px solid #d8e4f0;border-radius:12px;background:#fff;padding:0 12px}
#app .admin-native .adn-search-box input{width:100%;height:40px;border:0;outline:0;background:transparent;font-weight:850;color:#17304e;text-transform:uppercase}
#app .admin-native .adn-mini span{cursor:pointer;border-radius:999px;padding:4px 7px;transition:background .12s ease,box-shadow .12s ease}
#app .admin-native .adn-mini span.adn-status-active{background:#eef6ff;box-shadow:0 0 0 1px #bcd5ef inset}
#app .admin-native .adn-log-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
#app .admin-native .adn-log-head h3{margin:0}
#app .admin-native .adn-log-btn{border:1px solid #cfe0f1;background:#eef6ff;color:#076fd1;border-radius:10px;padding:7px 10px;font-size:10px;font-weight:950;white-space:nowrap}
.adn-log-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}.adn-log-filters label{display:flex;align-items:center;gap:6px;font-weight:900;font-size:11px;color:#35506f}.adn-log-filters input,.adn-log-filters select{border:1px solid #cfd9e6;border-radius:9px;padding:7px 9px;font:inherit;font-size:12px}.adn-log-filters input[type=search]{flex:1;min-width:140px}.adn-log-count{font-weight:900;font-size:11px;color:#53708f}
.adn-log-modal-list{display:grid;gap:7px}.adn-log-modal-row{display:grid;grid-template-columns:90px 85px 70px 1fr;gap:8px;align-items:center;border:1px solid #e3eaf2;border-radius:10px;padding:9px 10px;background:#fbfdff;font-size:10px}.adn-log-modal-row.bad{background:#fff5f6}.adn-log-modal-row.partial{background:#fffaf0}.adn-log-modal-row b{font-size:11px}.adn-log-modal-empty{padding:12px;color:#71839a;font-weight:850}
@media(max-width:700px){#app .admin-native .adn-search-box{min-width:100%}.adn-log-modal-row{grid-template-columns:75px 70px 1fr}.adn-log-modal-row span:last-child{grid-column:1/-1}}
</style><script id="alyzia-admin-dashboard-v3-js">(()=>{'use strict';
if(window.__alyziaAdminV3)return;window.__alyziaAdminV3=true;
let searchValue='',statusFilter='ALL';
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
function stateOfRow(tr){return norm(tr?.querySelector('.adn-badge')?.textContent||'')}
function applyFilters(){
 const app=document.getElementById('app');if(!app)return;const q=norm(searchValue);
 app.querySelectorAll('.adn-table tbody tr').forEach(tr=>{const state=stateOfRow(tr);const text=norm(tr.textContent);const statusOk=statusFilter==='ALL'||state===statusFilter;const searchOk=!q||text.includes(q);tr.style.display=statusOk&&searchOk?'':'none'});
 app.querySelectorAll('.adn-mini span[data-admin-status]').forEach(s=>s.classList.toggle('adn-status-active',s.dataset.adminStatus===statusFilter));
}
function patchFlightBack(){
 [0,30,90,180,350].forEach(ms=>setTimeout(()=>{const b=document.querySelector('#app .flight-back-btn');if(!b||b.dataset.adminReturnPatched)return;b.dataset.adminReturnPatched='1';b.onclick=e=>{e?.preventDefault?.();window.renderAdminDashboard?.()};},ms));
}
async function openLogModal(){
 const date0=document.getElementById('adminDateInput')?.value; if(!date0)return;
 let d=null;try{const r=await fetch('/api/admin/flight-processing',{cache:'no-store'});d=await r.json()}catch{}
 const all=d?.flights||[],dates=[...new Set(all.map(x=>x.date))].sort();
 const rowHtml=x=>{const s=String(x.state||'');const c=s==='EN ATTENTE'?'partial':s==='OK'?'':'bad';const last=x.checkedAt?new Date(x.checkedAt).toLocaleString('fr-FR'):'—';return '<div class="adn-log-modal-row '+c+'"><b>'+esc(x.flight||'—')+'</b><span>'+esc(x.destination||'—')+'</span><span>'+esc(s||'—')+'</span><span>DERNIER : '+esc(last)+' · MANQUE : '+esc((x.missing||[]).join(', ')||'—')+'</span></div>'};
 const shell='<div class="adn-log-filters"><label>DATE <input type="date" id="adnLogDate" value="'+esc(date0)+'"'+(dates.length?' min="'+esc(dates[0])+'" max="'+esc(dates[dates.length-1])+'"':'')+'></label><input type="search" id="adnLogQ" placeholder="VOL · DESTINATION · MANQUE"><select id="adnLogSt"><option value="">TOUS LES STATUTS</option><option>OK</option><option>EN ATTENTE</option><option>À CONTRÔLER</option><option>NON TRAITÉ</option></select><span id="adnLogCount" class="adn-log-count"></span></div><div id="adnLogList" class="adn-log-modal-list"></div>';
 if(typeof showModal==='function')showModal('LOG TRAITEMENT',date0,shell);
 setTimeout(()=>{
  const dEl=document.getElementById('adnLogDate'),qEl=document.getElementById('adnLogQ'),sEl=document.getElementById('adnLogSt'),list=document.getElementById('adnLogList'),cnt=document.getElementById('adnLogCount');if(!list)return;
  const paint=()=>{const date=dEl?.value||date0,q=norm(qEl?.value||''),st=sEl?.value||'';const rows=all.filter(x=>x.date===date&&(!st||String(x.state||'')===st)&&(!q||norm([x.flight,x.destination,x.state,(x.missing||[]).join(' ')].join(' ')).includes(q)));
   if(cnt)cnt.textContent=rows.length+' VOL'+(rows.length>1?'S':'');list.innerHTML=rows.length?rows.map(rowHtml).join(''):'<div class="adn-log-modal-empty">AUCUN VOL POUR CES FILTRES</div>'};
  [dEl,qEl,sEl].forEach(el=>el&&el.addEventListener('input',paint));paint();
 },0);
}
function enhance(){
 const app=document.getElementById('app');const root=app?.querySelector('.admin-native');if(!root)return;
 const section=[...root.querySelectorAll('.adn-section')].find(s=>s.querySelector('.adn-table'));
 if(section&&!section.querySelector('.adn-search-row')){
   const mini=section.querySelector('.adn-mini');
   if(mini){mini.querySelectorAll('span').forEach(s=>{const t=norm(s.textContent);s.dataset.adminStatus=t.startsWith('OK ')?'OK':t.startsWith('EN ATTENTE ')?'PARTIEL':t.startsWith('A CONTROLER ')?'A CONTROLER':t.startsWith('NON TRAITE ')?'NON TRAITE':'ALL'});const row=document.createElement('div');row.className='adn-search-row';row.innerHTML='<label class="adn-search-box"><span>⌕</span><input id="adminFlightSearch" autocomplete="off" placeholder="RECHERCHER : COMPAGNIE · CODE · VOL · DESTINATION" value="'+esc(searchValue)+'"></label>';mini.after(row);row.querySelector('input')?.addEventListener('input',e=>{searchValue=e.target.value;applyFilters()});mini.querySelectorAll('span').forEach(s=>s.addEventListener('click',()=>{const v=s.dataset.adminStatus||'ALL';statusFilter=statusFilter===v?'ALL':v;applyFilters()}));}
 }
 const logSection=[...root.querySelectorAll('.adn-section')].find(s=>norm(s.querySelector('h3')?.textContent).startsWith('LOG TRAITEMENT'));
 if(logSection&&!logSection.querySelector('.adn-log-btn')){const h=logSection.querySelector('h3');if(h){const wrap=document.createElement('div');wrap.className='adn-log-head';h.parentNode.insertBefore(wrap,h);wrap.appendChild(h);const b=document.createElement('button');b.className='adn-log-btn';b.type='button';b.textContent='AFFICHER LES VOLS';b.addEventListener('click',openLogModal);wrap.appendChild(b)}}
 applyFilters();
}
window.addEventListener('adn:repaint',()=>setTimeout(enhance,0));
const original=window.renderAdminDashboard;
if(typeof original==='function')window.renderAdminDashboard=async function(...args){const r=await original.apply(this,args);enhance();return r};
document.addEventListener('click',e=>{
 const row=e.target?.closest?.('#app .admin-native .adn-table tbody tr');if(row)patchFlightBack();
 const ctl=e.target?.closest?.('#adminPrev,#adminNext,#adminDateBtn,[data-terminal],#adminRefreshBtn');if(ctl)setTimeout(enhance,0);
},true);
document.addEventListener('change',e=>{if(e.target?.id==='adminDateInput')setTimeout(enhance,0)},true);
setTimeout(enhance,0);
})();</script>`;

function patch(html){let s=String(html||'');if(s.includes('id="alyzia-admin-dashboard-v3-js"'))return s;const i=s.lastIndexOf('</body>');return i>=0?s.slice(0,i)+UI+'\n'+s.slice(i):s+UI}

export default {
  async fetch(request,env,ctx){
    const response=await app.fetch(request,env,ctx);
    const type=String(response.headers.get('content-type')||'').toLowerCase();
    if(!type.includes('text/html'))return response;
    const html=await response.text(),headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store');
    return new Response(patch(html),{status:response.status,statusText:response.statusText,headers});
  },
  scheduled(controller,env,ctx){if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx)}
};
