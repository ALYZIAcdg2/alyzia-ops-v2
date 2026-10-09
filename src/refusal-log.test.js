import test from "node:test";
import assert from "node:assert/strict";
import {noteRefusal,saveRefusals,fetchFlightAwareLive} from "./ops-public-live-flow-optimized.js";
import {setFlightAwareEnabled} from "./fa-policy.js";setFlightAwareEnabled(true);   // FlightAware est arrêté par défaut ; ces tests vérifient sa logique quand il est rallumé
const mkEnv=()=>{const store={};return {store,OPS_DB:{prepare:q=>({run:async()=>{},first:async()=>store.v?{v:store.v}:null,bind:(...a)=>({run:async()=>{if(q.includes("INSERT"))store.v=a[0]},first:async()=>store.v?{v:store.v}:null})})}}};
test("refus : adresse sans domaine, code, Retry-After, début de réponse sans balises",async()=>{
  const env=mkEnv();
  noteRefusal("FLIGHTSTATS","https://www.flightstats.com/v2/flight-tracker/TK/1830?year=2026&month=10&date=7",{status:403,headers:{get:k=>k==="retry-after"?"120":k==="server"?"cloudflare":null}},"<html><head><style>x{}</style></head><body><h1>Access denied</h1> <p>Error 1020</p></body></html>");
  assert.equal(await saveRefusals(env),true);
  const list=JSON.parse(env.store.v),e=list[list.length-1];
  assert.deepEqual([e.source,e.status,e.retryAfter,e.server],["FLIGHTSTATS",403,"120","cloudflare"]);
  assert.match(e.path,/^\/v2\/flight-tracker\/TK\/1830\?year=2026/);assert.equal(e.snippet,"Access denied Error 1020");
  assert.equal(await saveRefusals(env),false); // rien de nouveau
});
test("FlightAware : une réponse 429 est consignée avec son début de réponse",async()=>{
  const real=globalThis.fetch;globalThis.fetch=async()=>new Response("Too Many Requests",{status:429,headers:{"retry-after":"600"}});
  const env=mkEnv();
  try{await fetchFlightAwareLive({airline:"TK",number:"1830",designator:"TK1830",date:"2026-10-07",std:"07:20",origin:"CDG",destination:"IST"},"https://www.flightaware.com/live/flight/THY1830/history/20261007/0530Z/LFPG/LTFM")}finally{globalThis.fetch=real}
  await saveRefusals(env);const e=JSON.parse(env.store.v).pop();
  assert.deepEqual([e.source,e.status,e.retryAfter,e.snippet],["FLIGHTAWARE",429,"600","Too Many Requests"]);
});
