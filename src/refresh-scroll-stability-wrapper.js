import app from "./v2-compat-schema-wrapper.js";

const SCROLL_STABILITY=String.raw`<style id="alyzia-refresh-scroll-anchor-css">
html,body,#app{overflow-anchor:none!important}
</style><script id="alyzia-refresh-scroll-stability-js">(()=>{
  'use strict';
  if(window.__alyziaRefreshScrollStabilityV2)return;
  window.__alyziaRefreshScrollStabilityV2=true;

  const detailVisible=()=>Boolean(document.querySelector('#app .flight-head'));
  const rows=()=>[...document.querySelectorAll('#app .flight-home-row')];
  const norm=v=>String(v??'').trim().toUpperCase().replace(/\s+/g,'');
  const rowKey=row=>{
    if(!row)return '';
    const flight=norm(row.querySelector('.v2-flight,.home-flight')?.textContent||'');
    const dest=norm(row.querySelector('.v2-destination,.home-destination,[data-destination]')?.textContent||row.getAttribute('data-destination')||'');
    const idx=String(row.getAttribute('data-flight-index')||'');
    if(flight)return 'F:'+flight+'|D:'+dest;
    const onclick=String(row.getAttribute('onclick')||row.querySelector('.home-open')?.getAttribute('onclick')||'');
    const m=onclick.match(/openFlightFromHomeList\((\d+)\)/);
    return idx?'I:'+idx:(m?'I:'+m[1]:'');
  };
  const capture=()=>{
    if(detailVisible())return null;
    const y=window.scrollY||0;
    const visible=rows().filter(r=>{const b=r.getBoundingClientRect();return b.height>0&&b.bottom>0&&b.top<innerHeight});
    const row=visible.sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top)[0]||null;
    return {key:rowKey(row),top:row?row.getBoundingClientRect().top:0,y};
  };
  const findRow=key=>{
    if(!key)return null;
    return rows().find(r=>rowKey(r)===key)||null;
  };

  let active=null;
  let observer=null;
  let mutationTimer=null;
  let generation=0;
  const stop=()=>{
    generation++;
    active=null;
    clearTimeout(mutationTimer);
    if(observer){observer.disconnect();observer=null}
  };
  const apply=token=>{
    if(!active||token!==generation||detailVisible()||Date.now()>active.until)return;
    const row=findRow(active.anchor.key);
    if(row){
      const delta=row.getBoundingClientRect().top-active.anchor.top;
      if(Math.abs(delta)>1)window.scrollBy({top:delta,left:0,behavior:'auto'});
    }else if(Math.abs((window.scrollY||0)-active.anchor.y)>2){
      window.scrollTo({top:active.anchor.y,left:0,behavior:'auto'});
    }
  };
  const stabilize=anchor=>{
    if(!anchor||detailVisible())return;
    stop();
    const token=generation;
    active={anchor,until:Date.now()+1800};
    const schedule=delay=>setTimeout(()=>apply(token),delay);
    apply(token);
    requestAnimationFrame(()=>{apply(token);requestAnimationFrame(()=>apply(token))});
    [40,100,180,300,500,750,1050,1400,1750].forEach(schedule);
    const appNode=document.getElementById('app');
    if(appNode&&typeof MutationObserver==='function'){
      observer=new MutationObserver(()=>{
        clearTimeout(mutationTimer);
        mutationTimer=setTimeout(()=>apply(token),16);
      });
      observer.observe(appNode,{childList:true,subtree:true,attributes:true,characterData:true});
      setTimeout(()=>{if(token===generation)stop()},1850);
    }
  };

  // Si l'utilisateur agit volontairement pendant la fenêtre de stabilisation,
  // on ne lutte jamais contre son propre scroll/navigation.
  ['wheel','touchstart','pointerdown'].forEach(type=>window.addEventListener(type,stop,{capture:true,passive:true}));
  window.addEventListener('keydown',e=>{
    if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(e.key))stop();
  },true);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#app .flight-home-row,#app [data-flight-index],#app .ops-search-flight'))stop();
  },true);

  // Une réponse réseau ne signifie pas qu'un rendu va suivre (delta vide,
  // erreur, autre onglet). Ne jamais restaurer une position prise avant une
  // requête : l'utilisateur peut avoir défilé pendant son attente.
  // Les hooks ci-dessous capturent la position au moment du vrai rendu.

  function install(){
    let installed=0;
    try{
      if(typeof render==='function'&&!render.__alyziaAnchorStable){
        const original=render;
        const wrapped=function(...args){
          const beforeDetail=detailVisible();
          const anchor=!beforeDetail?capture():null;
          const out=original.apply(this,args);
          const afterDetail=detailVisible();
          if(!beforeDetail&&!afterDetail&&anchor)stabilize(anchor);
          return out;
        };
        wrapped.__alyziaAnchorStable=true;
        render=wrapped;
        installed++;
      }
    }catch{}
    try{
      if(typeof renderHome==='function'&&!renderHome.__alyziaAnchorStable){
        const original=renderHome;
        const wrapped=function(...args){
          const wasHome=!detailVisible();
          const anchor=wasHome?capture():null;
          const out=original.apply(this,args);
          if(wasHome&&!detailVisible()&&anchor)stabilize(anchor);
          return out;
        };
        wrapped.__alyziaAnchorStable=true;
        renderHome=wrapped;
        installed++;
      }
    }catch{}
    return installed;
  }

  let tries=0;
  const retry=()=>{tries++;install();if(tries<40)setTimeout(retry,250)};
  retry();
})();</script>`;

function patch(html){
  let s=String(html||'');
  // Remplace aussi l'ancien patch V1 si le HTML a été retraité par un cache intermédiaire.
  if(s.includes('id="alyzia-refresh-scroll-stability-js"'))return s;
  const i=s.lastIndexOf('</body>');
  return i>=0?s.slice(0,i)+SCROLL_STABILITY+'\n'+s.slice(i):s+SCROLL_STABILITY;
}

export default {
  async fetch(request,env,ctx){
    const response=await app.fetch(request,env,ctx);
    const type=String(response.headers.get('content-type')||'').toLowerCase();
    if(!type.includes('text/html'))return response;
    const html=await response.text();
    const headers=new Headers(response.headers);
    headers.delete('content-length');
    headers.set('cache-control','no-store');
    return new Response(patch(html),{status:response.status,statusText:response.statusText,headers});
  },
  scheduled(controller,env,ctx){
    if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx);
  }
};
