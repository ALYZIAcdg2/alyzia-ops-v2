import app from "./flight-ui-runtime-stability-wrapper.js";
import {STA_PUBLIC_SOURCE_ORDER} from "./sta-public-fallbacks.js";

function json(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store",...headers}});
}

async function patchJsonResponse(response,kind){
  const type=String(response.headers.get("content-type")||"").toLowerCase();
  if(!type.includes("application/json"))return response;
  let data;try{data=await response.clone().json()}catch{return response}
  if(kind==="flow"&&data?.ok&&Array.isArray(data.flights)){
    data.flights=data.flights.map(f=>f?.nextSource==="STA OK"?f:{...f,nextSource:"FlightStats",nextChain:STA_PUBLIC_SOURCE_ORDER});
  }
  if(kind==="push"&&data?.ok)data.sources=STA_PUBLIC_SOURCE_ORDER;
  return json(data,response.status);
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==="/api/admin/public-flow")return patchJsonResponse(await app.fetch(request,env,ctx),"flow");
    if(url.pathname==="/api/admin/push-now")return patchJsonResponse(await app.fetch(request,env,ctx),"push");
    return app.fetch(request,env,ctx);
  },
  scheduled(controller,env,ctx){if(typeof app.scheduled==="function")return app.scheduled(controller,env,ctx)}
};
