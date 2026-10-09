import test from "node:test";
import assert from "node:assert/strict";
import {fetchFlightAwareLive,flightAwareExport,flightAwareImport,flightAwareReset} from "./ops-public-live-flow-optimized.js";
import {setFlightAwareEnabled} from "./fa-policy.js";setFlightAwareEnabled(true);   // FlightAware est arrêté par défaut ; ces tests vérifient sa logique quand il est rallumé
const f={airline:"TK",number:"1830",designator:"TK1830",date:"2026-10-07",std:"07:20",origin:"CDG",destination:"IST"};
const url=n=>`https://www.flightaware.com/live/flight/THY${n}/history/20261007/0530Z/LFPG/LTFM`;
test("après un 429, les requêtes déjà en file ne partent plus",async()=>{
  flightAwareReset();let n=0;const real=globalThis.fetch;
  globalThis.fetch=async()=>{n++;return new Response("Error Enable JavaScript and cookies to continue",{status:429})};
  try{
    const r=await Promise.all([fetchFlightAwareLive(f,url(1830)),fetchFlightAwareLive(f,url(1831)),fetchFlightAwareLive(f,url(1832))]);
    assert.equal(n,1);assert.deepEqual(r.map(x=>x.status),["HTTP_429","COOLDOWN","COOLDOWN"]);
    assert.ok(flightAwareExport().until>Date.now()+44*60000);
  }finally{globalThis.fetch=real;flightAwareReset()}
});
test("la pause enregistrée par un passage précédent est reprise : aucune requête",async()=>{
  flightAwareReset();flightAwareImport({until:Date.now()+30*60000});let n=0;const real=globalThis.fetch;
  globalThis.fetch=async()=>{n++;return new Response("ok",{status:200})};
  try{const r=await fetchFlightAwareLive(f,url(1830));assert.equal(n,0);assert.equal(r.status,"COOLDOWN")}finally{globalThis.fetch=real;flightAwareReset()}
  flightAwareImport({until:1});assert.equal(flightAwareExport().until,0); // une pause déjà finie n'est pas reprise
});
