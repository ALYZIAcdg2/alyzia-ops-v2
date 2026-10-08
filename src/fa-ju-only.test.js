import test from "node:test";
import assert from "node:assert/strict";
import {flightAwareAllowed,FA_ONLY_AIRLINES} from "./ops-public-live-flow-optimized.js";
test("FlightAware réservé aux vols JU sans ATD", () => {
  assert.deepEqual(FA_ONLY_AIRLINES,["JU"]);
  assert.equal(flightAwareAllowed("JU241",{}),true);
  assert.equal(flightAwareAllowed("ju 241",{atd:""}),true);
  assert.equal(flightAwareAllowed("JU241",{atd:"08:05"}),false);   // ATD connu : plus de lecture
  assert.equal(flightAwareAllowed("AT779",{}),false);
  assert.equal(flightAwareAllowed("SK564",{}),false);
});
