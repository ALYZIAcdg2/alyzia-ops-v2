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

import {priority} from "./ops-public-live-flow-optimized.js";
test("priorité : vol JU parti ou STD passée sans ATD en tête (0.2), pas les autres", () => {
  const now=Date.parse("2026-10-08T11:30:00Z");
  const done={flight:"JU241",std:"10:00",takeoff:"10:49",landing:"12:50",ata:"13:00"};
  assert.equal(priority({std:"10:00",flight_date:"2026-10-08"},done,810,now)[0],0.2);                                  // arrivé sans ATD
  assert.equal(priority({std:"10:00",flight_date:"2026-10-08"},{...done,atd:"10:30"},810,now)[0]===0.2,false);        // ATD présent
  assert.equal(priority({std:"10:00",flight_date:"2026-10-08"},{...done,flight:"AT779"},810,now)[0]===0.2,false);      // autre compagnie
  assert.equal(priority({std:"10:00",flight_date:"2026-10-08"},{...done,publicLiveBackfill:{checkedAt:new Date(now-3*60000).toISOString()}},810,now)[0]===0.2,false); // lu il y a moins de 10 min
  assert.equal(priority({std:"15:00",flight_date:"2026-10-08"},{flight:"JU999",std:"15:00"},810,now)[0]===0.2,false);   // pas encore parti, STD future
});
