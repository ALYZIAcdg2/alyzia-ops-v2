import app from "./ui-first-paint-wrapper.js";
import {handlePublicWebConsolidation} from "./public-web-consolidation-routes.js";

export default {
  async fetch(request,env,ctx){
    const routed=await handlePublicWebConsolidation(request,env,ctx);
    if(routed)return routed;
    return app.fetch(request,env,ctx);
  },
  scheduled(controller,env,ctx){
    if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx);
  }
};
