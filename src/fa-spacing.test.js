import test from "node:test";
import assert from "node:assert/strict";
import {fetchFlightAwareLive} from "./ops-public-live-flow-optimized.js";
test("FlightAware : requêtes les unes après les autres, espacées (pas de rafale)",async()=>{
  const times=[],real=globalThis.fetch;
  globalThis.fetch=async()=>{times.push(Date.now());return new Response("<html></html>",{status:200})};
  try{
    const f={airline:"TK",number:"1830",designator:"TK1830",date:"2026-10-07",std:"07:20",origin:"CDG",destination:"IST"};
    await Promise.all([fetchFlightAwareLive(f,"https://www.flightaware.com/live/flight/THY1830/history/20261007/0530Z/LFPG/LTFM"),fetchFlightAwareLive(f,"https://www.flightaware.com/live/flight/THY1831/history/20261007/0530Z/LFPG/LTFM")]);
  }finally{globalThis.fetch=real}
  assert.equal(times.length,2);assert.ok(times[1]-times[0]>=1100,"écart "+(times[1]-times[0]));
});
