import test from "node:test";
import assert from "node:assert/strict";
import {flightAwareAllowed,flightAwareEnabled,setFlightAwareEnabled} from "./fa-policy.js";
import {fetchFlightAwareLive} from "./ops-public-live-flow-optimized.js";
import {recoverFlightAwareExactHistory} from "./flightaware-exact-history.js";
test("FlightAware arrêté par défaut : plus aucune lecture",async()=>{
  assert.equal(flightAwareEnabled(),false);
  const x={std:"10:00",takeoff:"10:10"},old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response("x")};
  try{
    assert.equal(flightAwareAllowed("JU241",x,Date.parse("2026-10-09T12:00:00Z"),"2026-10-09"),false);
    assert.equal(await fetchFlightAwareLive({designator:"JU241",airline:"JU",number:"241",date:"2026-10-09",origin:"CDG"},""),null);
    const r=await recoverFlightAwareExactHistory({OPS_DB:{prepare(){throw new Error("ne doit pas lire la base")}}});
    assert.equal(r.disabled,true);
    assert.equal(calls,0);
  }finally{globalThis.fetch=old}
  setFlightAwareEnabled(true);assert.equal(flightAwareAllowed("JU241",{std:"10:00",takeoff:"10:10"},Date.parse("2026-10-09T12:00:00Z"),"2026-10-09"),true);setFlightAwareEnabled(false);
});
