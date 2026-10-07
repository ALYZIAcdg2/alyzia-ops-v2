// Réorganisation de l'ADMIN, appliquée par-dessus les couches existantes (rien n'est recréé : les boutons sont déplacés, leurs écouteurs restent).
// 1. Barre d'outils : PROCHAIN PASSAGE · PUSH · ACTUALISER visibles ; LOGS, SOURCES PUBLIQUES, IMMAT, RESET FILTRES rangés dans un menu « OUTILS ».
// 2. Pastilles de sources : une seule ligne compacte avec un point de couleur ; le détail s'ouvre avec « DÉTAIL ».
export const ADMIN_REORG_UI=String.raw`<style id="alyzia-admin-reorg-css">
#app .admin-native .adn-head{align-items:flex-start;flex-wrap:wrap}
#app .adn-v4-actions{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:10px;justify-content:flex-end}
#app .adx-tools{position:relative;display:inline-block}
#app .adx-tools-panel{position:absolute;right:0;top:calc(100% + 8px);z-index:60;min-width:230px;display:none;flex-direction:column;gap:6px;padding:10px;background:#fff;border:1px solid #dfe8f2;border-radius:16px;box-shadow:0 18px 44px rgba(10,31,61,.22)}
#app .adx-tools.open .adx-tools-panel{display:flex}
#app .adx-tools-panel>*{width:100%;justify-content:flex-start;text-align:left;margin:0!important;white-space:nowrap}
#app .adx-tools-panel small{display:block;margin:2px 4px 4px;font-size:10px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;color:#7890a6}
#app .adx-health:not(.adx-health-copy){flex-wrap:nowrap;overflow-x:auto;align-items:center;gap:8px;padding-bottom:4px;scrollbar-width:thin}
#app .adx-health:not(.adx-health-copy) .adx-h{flex:0 0 auto;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
#app .adx-health:not(.adx-health-copy) .adx-h::before{content:"";width:9px;height:9px;border-radius:50%;background:#9db0c4;flex:0 0 auto}
#app .adx-health .adx-h.adx-ok::before{background:#16a36a}#app .adx-health .adx-h.adx-warn::before{background:#e08a00}#app .adx-health .adx-h.adx-bad::before{background:#d3213f}
#app .adx-health:not(.adx-health-copy):not(.adx-open) .adx-h small{display:none}
#app .adx-health:not(.adx-health-copy).adx-open{flex-wrap:wrap;overflow:visible}
#app .adx-health:not(.adx-health-copy).adx-open .adx-h{white-space:normal}
#app .adx-health-toggle{flex:0 0 auto;border:1px solid #cfe0f3;background:#eef5fd;color:#1769c9;border-radius:10px;padding:6px 10px;font-size:11px;font-weight:900;letter-spacing:.3px;cursor:pointer;text-transform:uppercase}
#app .adx-tools-panel{max-width:calc(100vw - 24px)}
@media(max-width:700px){#app .adn-v4-actions{justify-content:flex-start}}
</style><script id="alyzia-admin-reorg-js">(()=>{'use strict';
if(window.__alyziaAdminReorg)return;window.__alyziaAdminReorg=true;
let busy=false,raf=0;
function toolsMenu(){
 const head=document.querySelector('#app .admin-native .adn-head');if(!head)return;
 const actions=head.querySelector('.adn-v4-actions')||head;
 let menu=head.querySelector('.adx-tools');
 const targets=[...head.querySelectorAll('.adx-srcbtn,.adn-v4-btn.reset,#adminRegRestoreBtn')].concat([...head.querySelectorAll('.adn-v4-btn')].filter(b=>/^LOGS$/i.test((b.textContent||'').trim())));
 if(!menu&&!targets.length)return;
 if(!menu){menu=document.createElement('div');menu.className='adx-tools';
  const btn=document.createElement('button');btn.type='button';btn.className='adn-v4-btn adx-tools-btn';btn.textContent='OUTILS ▾';btn.setAttribute('aria-haspopup','true');btn.setAttribute('aria-expanded','false');
  const panel=document.createElement('div');panel.className='adx-tools-panel';panel.setAttribute('role','menu');panel.innerHTML='<small>Outils d’administration</small>';
  btn.addEventListener('click',e=>{e.stopPropagation();const o=menu.classList.toggle('open');btn.setAttribute('aria-expanded',o?'true':'false')});
  menu.append(btn,panel);actions.appendChild(menu);
 }
 const panel=menu.querySelector('.adx-tools-panel');
 const order=b=>/LOGS/i.test(b.textContent||'')?0:b.classList.contains('adx-srcbtn')?1:b.id==='adminRegRestoreBtn'?2:3;
 for(const b of targets.sort((a,b)=>order(a)-order(b)))if(b.parentElement!==panel)panel.appendChild(b);
}
function chips(){
 document.querySelectorAll('#app .adx-health:not(.adx-health-copy)').forEach(bar=>{
  bar.querySelectorAll('.adx-h').forEach(h=>{const cls=h.querySelector('.r')?'adx-bad':h.querySelector('.o')?'adx-warn':h.querySelector('.g')?'adx-ok':'';['adx-ok','adx-warn','adx-bad'].forEach(c=>h.classList.toggle(c,c===cls))});
  if(!bar.querySelector('.adx-health-toggle')&&bar.querySelector('.adx-h small')){const t=document.createElement('button');t.type='button';t.className='adx-health-toggle';t.textContent='DÉTAIL';t.addEventListener('click',()=>{const o=bar.classList.toggle('adx-open');t.textContent=o?'RÉDUIRE':'DÉTAIL';try{localStorage.setItem('alzHealthOpen',o?'1':'0')}catch{}});bar.appendChild(t);try{if(localStorage.getItem('alzHealthOpen')==='1'){bar.classList.add('adx-open');t.textContent='RÉDUIRE'}}catch{}}
 });
}
function apply(){if(busy)return;busy=true;try{toolsMenu();chips()}finally{busy=false}}
function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;apply()})}
document.addEventListener('click',e=>{const m=document.querySelector('#app .adx-tools.open');if(m&&!m.contains(e.target)){m.classList.remove('open');m.querySelector('.adx-tools-btn')?.setAttribute('aria-expanded','false')}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const m=document.querySelector('#app .adx-tools.open');if(m){m.classList.remove('open');m.querySelector('.adx-tools-btn')?.focus()}}});
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});schedule();
})();</script>`;
