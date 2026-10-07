import test from "node:test";
import assert from "node:assert/strict";
import {saveRefusals,fetchFlightAwareLive} from "./ops-public-live-flow-optimized.js";
// Fichier séparé : la pause FlightAware de 45 min (en mémoire) armée par un test 429 empêcherait cet appel.
const mkEnv=()=>{const store={};return {store,OPS_DB:{prepare:q=>({run:async()=>{},first:async()=>store.v?{v:store.v}:null,bind:(...a)=>({run:async()=>{if(q.includes("INSERT"))store.v=a[0]},first:async()=>store.v?{v:store.v}:null})})}}};
test("exception réseau (ex. trop de sous-requêtes) : consignée avec son message",async()=>{
  const real=globalThis.fetch;globalThis.fetch=async()=>{throw new Error("Too many subrequests")};
  const env=mkEnv();
  try{await fetchFlightAwareLive({airline:"TK",number:"1830",designator:"TK1830",date:"2026-10-07",std:"07:20",origin:"CDG",destination:"IST"},"https://www.flightaware.com/live/flight/THY1830/history/20261007/0530Z/LFPG/LTFM")}finally{globalThis.fetch=real}
  await saveRefusals(env);const e=JSON.parse(env.store.v).pop();
  assert.equal(e.source,"FLIGHTAWARE");assert.equal(e.status,0);assert.match(e.snippet,/EXCEPTION Error: Too many subrequests/);
});
