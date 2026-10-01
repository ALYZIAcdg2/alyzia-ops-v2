import app from "./public-results-entry-wrapper.js";
import {handleSingleFlightAudit} from "./single-flight-public-audit.js";

export default {
  async fetch(request,env,ctx){
    const audit=await handleSingleFlightAudit(request,env,ctx);
    if(audit)return audit;
    return app.fetch(request,env,ctx);
  },
  scheduled(controller,env,ctx){
    if(typeof app.scheduled==="function")return app.scheduled(controller,env,ctx);
  }
};
