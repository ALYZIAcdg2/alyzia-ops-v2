import app from './v2-admin-public-flow-wrapper.js';
import {runExactFr24PriorityRecovery} from './exact-fr24-priority-recovery.js';

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/api/admin/push-now'&&request.method==='POST')await runExactFr24PriorityRecovery(env).catch(()=>{});
    const response=await app.fetch(request,env,ctx);
    if(url.pathname!=='/api/admin/flight-processing')return response;
    let data;try{data=await response.clone().json()}catch{return response}
    if(!data?.ok||!Array.isArray(data.flights))return response;
    for(const f of data.flights){if(String(f.flightStatus||'').toUpperCase()==='EN VOL'){f.state='OK';f.missing=[]}}
    const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store');
    return new Response(JSON.stringify(data),{status:response.status,headers});
  },
  scheduled(controller,env,ctx){if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx)}
};
