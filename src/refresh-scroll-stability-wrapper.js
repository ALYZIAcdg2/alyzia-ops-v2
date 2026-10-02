import app from "./v2-compat-schema-wrapper.js";

const SCROLL_STABILITY=String.raw`<script id="alyzia-refresh-scroll-stability-js">(()=>{
  'use strict';
  if(window.__alyziaRefreshScrollStability)return;
  window.__alyziaRefreshScrollStability=true;

  const detailVisible=()=>Boolean(document.querySelector('#app .flight-head'));
  const restore=(y,expectDetail)=>{
    const apply=()=>{
      if(detailVisible()!==expectDetail)return;
      if(Math.abs((window.scrollY||0)-y)>2)window.scrollTo({top:y,left:0,behavior:'auto'});
    };
    apply();
    requestAnimationFrame(()=>{apply();requestAnimationFrame(apply)});
  };

  function install(){
    let installed=0;
    try{
      if(typeof render==='function'&&!render.__alyziaRefreshScrollStable){
        const original=render;
        const wrapped=function(...args){
          const beforeDetail=detailVisible();
          const y=window.scrollY||0;
          const out=original.apply(this,args);
          const afterDetail=detailVisible();
          // Navigation explicite liste -> fiche : conserver le comportement existant (fiche en haut).
          // Tout autre rendu silencieux doit conserver exactement la position de lecture.
          if(!(beforeDetail===false&&afterDetail===true))restore(y,afterDetail);
          return out;
        };
        wrapped.__alyziaRefreshScrollStable=true;
        render=wrapped;
        installed++;
      }
    }catch{}
    try{
      if(typeof renderHome==='function'&&!renderHome.__alyziaRefreshScrollStable){
        const original=renderHome;
        const wrapped=function(...args){
          const beforeDetail=detailVisible();
          const y=window.scrollY||0;
          const out=original.apply(this,args);
          // Si on était déjà sur la liste, c'est un refresh/rerender : ne jamais remonter en haut.
          // Si on revient d'une fiche, le wrapper navigation existant restaure lastHomeScroll.
          if(!beforeDetail&&!detailVisible())restore(y,false);
          return out;
        };
        wrapped.__alyziaRefreshScrollStable=true;
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
  const s=String(html||'');
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
