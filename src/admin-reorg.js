// Réorganisation de l'ADMIN, appliquée par-dessus les couches existantes (rien n'est recréé : les boutons sont déplacés, leurs écouteurs restent).
// 1. Barre d'outils : PROCHAIN PASSAGE · PUSH · ACTUALISER visibles ; LOGS, SOURCES PUBLIQUES, IMMAT, RESET FILTRES rangés dans un menu « OUTILS ».
// 2. Pastilles de sources : une seule ligne compacte avec un point de couleur ; le détail s'ouvre avec « DÉTAIL ».
export const ADMIN_REORG_UI=String.raw`<style id="alyzia-admin-reorg-css">
#app .admin-native .adn-head{align-items:flex-start;flex-wrap:wrap}
#app .adn-v4-actions{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:10px;justify-content:flex-end}
#app .adx-tools{position:relative;display:inline-block}
#app .adx-tools-panel{position:absolute;right:0;top:calc(100% + 8px);z-index:60;min-width:230px;display:none;flex-direction:column;gap:6px;padding:10px;background:#fff;border:1px solid #dfe8f2;border-radius:16px;box-shadow:0 18px 44px rgba(10,31,61,.22)}
#app .adx-tools.open .adx-tools-panel{display:flex}
#app .adx-tools-panel>button{display:flex!important;align-items:center!important;justify-content:flex-start!important;width:100%!important;margin:0!important;height:auto!important;min-height:0!important;padding:12px 14px!important;border:1px solid #cfe0f3!important;border-radius:12px!important;background:#eef5fd!important;color:#1769c9!important;box-shadow:none!important;font-family:inherit!important;font-size:14px!important;font-weight:900!important;line-height:1.2!important;letter-spacing:.3px!important;text-transform:uppercase!important;text-align:left!important;white-space:nowrap!important}
#app .adx-tools-panel>button:hover{background:#e1eefb!important}
#app .adx-tools-panel small{display:block;margin:2px 4px 4px;font-size:10px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;color:#7890a6}
#app .adx-health:not(.adx-health-copy){display:flex;flex-wrap:nowrap;overflow:hidden;align-items:center;gap:6px;margin:10px 0 12px;min-width:0}
#app .adx-health:not(.adx-health-copy) .adx-h{position:relative;display:block;flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 8px 5px 21px;font-size:10.5px!important;letter-spacing:0}
#app .adx-health:not(.adx-health-copy) .adx-h::before{content:"";position:absolute;left:8px;top:50%;transform:translateY(-50%);width:8px;height:8px;border-radius:50%;background:#9db0c4}
#app .adx-health:not(.adx-health-copy) .adx-h.adx-date{flex:0 0 auto;padding-left:10px;background:#eef5fd;border-color:#cfe0f3}
#app .adx-health:not(.adx-health-copy) .adx-h.adx-date::before{display:none}
#app .adx-health .adx-h.adx-ok::before{background:#16a36a}#app .adx-health .adx-h.adx-warn::before{background:#e08a00}#app .adx-health .adx-h.adx-bad::before{background:#d3213f}
#app .adx-health:not(.adx-health-copy):not(.adx-open) .adx-h small{display:none}
#app .adx-health:not(.adx-health-copy).adx-open{flex-wrap:wrap;overflow:visible}
#app .adx-health:not(.adx-health-copy).adx-open .adx-h{white-space:normal;overflow:visible;text-overflow:clip;flex:0 1 auto}
#app .adx-health-toggle{flex:0 0 auto;margin-left:auto;border:1px solid #cfe0f3;background:#eef5fd;color:#1769c9;border-radius:10px;padding:6px 10px;font-size:11px;font-weight:900;letter-spacing:.3px;cursor:pointer;text-transform:uppercase}
#app .adx-tools-panel{max-width:calc(100vw - 24px)}
@media(max-width:700px){#app .adn-v4-actions{justify-content:flex-start}}
</style><script id="alyzia-admin-reorg-js">(()=>{'use strict';
if(window.__alyziaAdminReorg)return;window.__alyziaAdminReorg=true;
let busy=false,raf=0;
function toolsMenu(){
 const head=document.querySelector('#app .admin-native .adn-head');if(!head)return;
 const actions=head.querySelector('.adn-v4-actions')||head;
 let menu=head.querySelector('.adx-tools');
 const targets=[...head.querySelectorAll('.adx-srcbtn,.adn-v4-btn.reset,#adminRegRestoreBtn,#adminReadOneBtn')].concat([...head.querySelectorAll('.adn-v4-btn')].filter(b=>/^LOGS$/i.test((b.textContent||'').trim())));
 if(!menu&&!targets.length&&!actions.querySelector('#adminPushBtn,#adminRefreshBtn'))return;
 if(!menu){menu=document.createElement('div');menu.className='adx-tools';
  const btn=document.createElement('button');btn.type='button';btn.className='adn-v4-btn adx-tools-btn';btn.textContent='OUTILS ▾';
  const ref=head.querySelector('#adminRefreshBtn')||head.querySelector('#adminPushBtn');if(ref){const cs=getComputedStyle(ref);for(const k of ['fontSize','fontWeight','fontFamily','letterSpacing','textTransform','padding','borderRadius','backgroundColor','color','border','lineHeight','boxShadow'])btn.style[k]=cs[k]}btn.setAttribute('aria-haspopup','true');btn.setAttribute('aria-expanded','false');
  const panel=document.createElement('div');panel.className='adx-tools-panel';panel.setAttribute('role','menu');panel.innerHTML='<small>Outils d’administration</small>';
  btn.addEventListener('click',e=>{e.stopPropagation();const o=menu.classList.toggle('open');btn.setAttribute('aria-expanded',o?'true':'false')});
  menu.append(btn,panel);actions.appendChild(menu);
 }
 const panel=menu.querySelector('.adx-tools-panel');
 if(!panel.querySelector('#adminReadOneBtn')){const b=document.createElement('button');b.type='button';b.id='adminReadOneBtn';b.className='adn-v4-btn';b.textContent='↻ RELIRE UN VOL';b.title='Choisir un vol et relire toutes ses sources (FlightStats / FlightAware compris)';b.addEventListener('click',()=>{menu.classList.remove('open');readOne(b)});panel.appendChild(b)}
 const order=b=>/LOGS/i.test(b.textContent||'')?0:b.classList.contains('adx-srcbtn')?1:b.id==='adminReadOneBtn'?2:b.id==='adminRegRestoreBtn'?3:4;
 // Style imposé en ligne (!important) : les anciennes couches stylent ces boutons par identifiant, plus prioritaire qu'une règle de feuille.
 const UNIFORM={display:'flex','align-items':'center','justify-content':'flex-start',width:'100%',margin:'0',height:'auto','min-height':'0',padding:'12px 14px',border:'1px solid #cfe0f3','border-radius':'12px',background:'#eef5fd',color:'#1769c9','box-shadow':'none','font-family':'inherit','font-size':'14px','font-weight':'900','line-height':'1.2','letter-spacing':'.3px','text-transform':'uppercase','text-align':'left','white-space':'nowrap'};
 for(const b of targets.sort((a,b)=>order(a)-order(b))){if(b.parentElement!==panel)panel.appendChild(b);if(!b.dataset.adxUniform){for(const k in UNIFORM)b.style.setProperty(k,UNIFORM[k],'important');b.dataset.adxUniform='1'}}
}
function chips(){
 document.querySelectorAll('#app .adx-health:not(.adx-health-copy)').forEach(bar=>{
  bar.querySelectorAll('.adx-h').forEach(h=>{const cls=h.querySelector('.r')?'adx-bad':h.querySelector('.o')?'adx-warn':h.querySelector('.g')?'adx-ok':'';['adx-ok','adx-warn','adx-bad'].forEach(c=>h.classList.toggle(c,c===cls))});
  if(!bar.querySelector('.adx-health-toggle')&&bar.querySelector('.adx-h small')){const t=document.createElement('button');t.type='button';t.className='adx-health-toggle';t.textContent='DÉTAIL';t.addEventListener('click',()=>{const o=bar.classList.toggle('adx-open');t.textContent=o?'RÉDUIRE':'DÉTAIL';try{localStorage.setItem('alzHealthOpen',o?'1':'0')}catch{}});bar.appendChild(t);try{if(localStorage.getItem('alzHealthOpen')==='1'){bar.classList.add('adx-open');t.textContent='RÉDUIRE'}}catch{}}
 });
}

// Relire un vol : choix du vol (liste du jour affiché), aperçu des nouvelles infos (lecture sans écriture), confirmation, application.
const LABELS={atd:'ATD',takeoff:'TO',eta:'ETA',landing:'LDG',ata:'ATA',reg:'IMMAT',status:'STATUT',aircraftActual:'A/C RÉEL'};
async function readOne(btn){
 const msg=document.getElementById('adnPushMsg'),say=t=>{if(msg)msg.textContent=t;btn.title=t},modal=window.alzModal;if(typeof modal!=='function')return say('Modal indisponible : rechargez la page');
 const date=(()=>{const v=document.getElementById('adminDateInput')?.value;return /^\d{4}-\d{2}-\d{2}$/.test(v||'')?v:''})(),old=btn.textContent;
 btn.disabled=true;btn.textContent='…';
 try{
  const r0=await fetch('/api/admin/flight-processing',{cache:'no-store'}),d0=await r0.json();if(!d0?.ok)throw new Error(d0?.error||('HTTP '+r0.status));
  const day=date||d0.date,list=(d0.flights||[]).filter(x=>x.date===day).sort((a,b)=>String(a.std).localeCompare(String(b.std)));
  if(!list.length)return say('Aucun vol pour le '+day);
  const key=await modal({title:'Relire un vol — '+day,search:true,pick:true,hideOk:true,cancel:'Fermer',sections:[{label:'Choisir un vol ('+day+')',tone:'muted',rows:list.map(x=>[x.flight+' · '+x.destination,(x.std||'—')+' · '+(x.flightStatus||x.state||''),x.flight])}]});
  if(!key)return say('Relecture annulée');
  btn.textContent='Lecture…';say('Lecture de '+key+'…');
  const q='?flight='+encodeURIComponent(key)+'&date='+encodeURIComponent(day),r1=await fetch('/api/admin/live-one'+q,{cache:'no-store'}),j=await r1.json();
  if(!j?.ok)throw new Error(j?.error||('HTTP '+r1.status));
  const res=j.result||{},before=res.before||{},after=res.after||{},changes=Object.keys(LABELS).filter(k=>String(before[k]??'')!==String(after[k]??'')&&(after[k]!=null&&after[k]!=='')).map(k=>[LABELS[k],(before[k]||'—')+' → '+after[k]]);
  const att=(res.attempts||[]).map(a=>[String(a.source||'?'),String(a.httpStatus||a.status||'—')]);
  const sections=[changes.length?{label:'Nouvelles infos ('+changes.length+')',tone:'good',rows:changes}:{label:'Aucune nouvelle info',tone:'muted',rows:[['Rien à modifier','sources déjà à jour']]}];
  if(att.length)sections.push({label:'Sources lues',tone:'muted',rows:att});
  const ok=await modal({title:key+' — relecture',sections,ok:changes.length?'Appliquer':'OK',cancel:changes.length?'Fermer':'Fermer',hideOk:!changes.length});
  if(!ok)return say('Relecture fermée sans application');
  btn.textContent='Application…';
  const r2=await fetch('/api/admin/live-one'+q,{method:'POST',cache:'no-store'}),k=await r2.json();
  if(k?.error==='TOO_SOON')return say('Déjà lu à l’instant · réessaie dans '+k.retryInSeconds+' s');
  if(!k?.ok)throw new Error(k?.error||('HTTP '+r2.status));
  say('✓ '+key+' relu · '+(k.result?.status==='UPDATED'?'mis à jour':'aucun changement'));
  try{await window.renderAdminDashboard?.(true)}catch{}
 }catch(e){say('ÉCHEC : '+(e?.message||e))}finally{btn.disabled=false;btn.textContent=old}
}
function apply(){if(busy)return;busy=true;try{toolsMenu();chips()}finally{busy=false}}
function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;apply()})}
document.addEventListener('click',e=>{const m=document.querySelector('#app .adx-tools.open');if(m&&!m.contains(e.target)){m.classList.remove('open');m.querySelector('.adx-tools-btn')?.setAttribute('aria-expanded','false')}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const m=document.querySelector('#app .adx-tools.open');if(m){m.classList.remove('open');m.querySelector('.adx-tools-btn')?.focus()}}});
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});schedule();
})();</script>`;
