import app from "./v2-ui-consistency-wrapper.js";
import {fetchFr24Public} from "./fr24-public-html.js";
import {runStatusModelTest} from "./status-model-test.js";

const EXACT={
  "AV55|2026-10-03":"41f30e95",
  "HF177|2026-10-03":"41f31243",
  "SQ335|2026-10-03":"41f35170"
};
const clean=v=>String(v??"").trim();
const upper=v=>clean(v).toUpperCase();
const today=()=>new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const hhmmParis=iso=>{if(!iso)return"";const d=new Date(iso);if(Number.isNaN(d.getTime()))return"";const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d).map(x=>[x.type,x.value]));return `${p.hour}:${p.minute}`};
const manual=(x,f)=>upper(x?.[f+"Source"]).includes("MANUAL")||Boolean(x?.manual?.[f]||x?.manualOverrides?.[f]||x?.manual_fields?.[f]);

async function recoverExact(env){
 if(!env?.OPS_DB)return {ok:false,error:"NO_DB"};
 const date=today(),keys=Object.keys(EXACT).filter(k=>k.endsWith(`|${date}`));if(!keys.length)return {ok:true,date,checked:0,updated:0};
 const flights=keys.map(k=>k.split('|')[0]);
 const q=flights.map(()=>'?').join(',');
 const {results=[]}=await env.OPS_DB.prepare(`SELECT identity,flight_number,airline,flight_date,data_json FROM flights WHERE flight_date=? AND flight_number IN (${q})`).bind(date,...flights).all();
 let updated=0;const items=[];
 for(const row of results){
  let x={};try{x=JSON.parse(row.data_json||"{}")}catch{}
  const designator=upper(x.flight||row.flight_number),id=EXACT[`${designator}|${date}`];if(!id)continue;
  const f={date,airline:upper(x.airline||row.airline),number:designator.replace(/^[A-Z0-9]{2,3}(?=\d)/,''),designator,origin:upper(x.origin||'CDG'),destination:upper(x.destination||x.dest||''),raw:{...x,fr24OccurrenceId:id}};
  const fr=await fetchFr24Public(f);const takeoff=hhmmParis(fr?.candidates?.semantic?.takeoff);let changed=false;
  x.fr24OccurrenceId=id;
  x.statusModelEvidence={...(x.statusModelEvidence||{}),fr24ExactOccurrence:id,fr24ExactCheckStatus:fr?.status||'',fr24ExactCheckedAt:new Date().toISOString()};
  if(takeoff&&!manual(x,'takeoff')){if(clean(x.takeoff)!==takeoff||upper(x.takeoffSource)!=='PUBLIC_LIVE:FR24'){x.takeoff=takeoff;x.takeoffSource='PUBLIC_LIVE:FR24';x.takeoffUpdatedAt=new Date().toISOString();changed=true}}
  if(changed){await env.OPS_DB.prepare(`UPDATE flights SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE identity=?`).bind(JSON.stringify(x),row.identity).run();updated++}
  items.push({identity:row.identity,flight:designator,fr24OccurrenceId:id,fetchStatus:fr?.status||'',takeoff:takeoff||null,changed});
 }
 const status=await runStatusModelTest(env);
 return {ok:true,date,checked:results.length,updated,items,statusModel:status};
}

export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.pathname==='/api/admin/exact-airborne-recovery'){
   try{return new Response(JSON.stringify(await recoverExact(env)),{headers:{'content-type':'application/json; charset=UTF-8','cache-control':'no-store'}})}catch(e){return new Response(JSON.stringify({ok:false,error:String(e?.message||e)}),{status:500,headers:{'content-type':'application/json; charset=UTF-8'}})}
  }
  if(url.pathname==='/api/admin/push-now'&&request.method==='POST'){
   const base=await app.fetch(request,env,ctx);let body={};try{body=await base.clone().json()}catch{}
   const recovery=await recoverExact(env).catch(e=>({ok:false,error:String(e?.message||e)}));
   return new Response(JSON.stringify({...body,exactAirborneRecovery:recovery}),{status:base.status,headers:{'content-type':'application/json; charset=UTF-8','cache-control':'no-store'}});
  }
  return app.fetch(request,env,ctx);
 },
 scheduled(controller,env,ctx){
  if(typeof app.scheduled==='function')app.scheduled(controller,env,ctx);
  ctx.waitUntil(recoverExact(env).catch(()=>{}));
 }
};
