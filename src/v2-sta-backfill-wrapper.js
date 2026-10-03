import app from "./v2-cabin-bootstrap-wrapper.js";
import {handleStaBackfill,runStaBackfill} from "./sta-backfill-public.js";

export default {
  async fetch(request,env,ctx){
    const sta=await handleStaBackfill(request,env);
    if(sta)return sta;
    return app.fetch(request,env,ctx);
  },
  scheduled(controller,env,ctx){
    // V2 API LOCK: ce cron ne délègue volontairement PAS au scheduler historique,
    // qui contient des fournisseurs API. Seul le backfill STA public J/J+1 tourne ici.
    ctx.waitUntil(runStaBackfill(env).catch(()=>{}));
  }
};
