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

import {needsLiveRead} from "./ops-public-live-flow-optimized.js";
test("vol JU arrivé sans ATD : toujours à relire ; autre compagnie complète : non", () => {
  const full={ata:"13:00",reg:"YU-APU",aircraft:"320"};
  assert.equal(needsLiveRead("2026-10-08","2026-10-08",{flight:"JU241",...full}),true);                 // ATD manquant
  assert.equal(needsLiveRead("2026-10-08","2026-10-08",{flight:"JU241",atd:"10:30",...full}),false);     // ATD présent
  assert.equal(needsLiveRead("2026-10-08","2026-10-08",{flight:"AT779",...full}),false);                 // autre compagnie : règle inchangée
});
