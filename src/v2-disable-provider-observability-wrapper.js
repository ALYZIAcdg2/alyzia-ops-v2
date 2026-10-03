import app from "./v2-admin-envol-exact-wrapper.js";

const GUARD=String.raw`<style id="alyzia-disable-provider-observability-css">#providerObservability,.provider-observability{display:none!important}</style><script id="alyzia-disable-provider-observability-js">(()=>{'use strict';try{window.__alyziaProviderObservability=true}catch{};const kill=()=>{document.querySelectorAll('#providerObservability,.provider-observability').forEach(n=>n.remove())};kill();document.addEventListener('DOMContentLoaded',kill,{once:true});})();</script>`;

function stripLegacyProviderUi(html){
  let s=String(html||"");
  s=s.replace(/<style\s+id=["']alyzia-provider-observability[^"']*["'][\s\S]*?<\/style>/gi,"");
  s=s.replace(/<script\s+id=["']alyzia-provider-observability[^"']*["'][\s\S]*?<\/script>/gi,"");
  const i=s.lastIndexOf("</body>");
  return i>=0?s.slice(0,i)+GUARD+"\n"+s.slice(i):s+GUARD;
}

export default {
  async fetch(request,env,ctx){
    const response=await app.fetch(request,env,ctx);
    const type=String(response.headers.get("content-type")||"").toLowerCase();
    if(!type.includes("text/html"))return response;
    const headers=new Headers(response.headers);headers.delete("content-length");headers.set("cache-control","no-store");
    return new Response(stripLegacyProviderUi(await response.text()),{status:response.status,statusText:response.statusText,headers});
  },
  scheduled(controller,env,ctx){if(typeof app.scheduled==="function")return app.scheduled(controller,env,ctx)}
};
