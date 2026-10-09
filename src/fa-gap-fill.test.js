import test from "node:test";
import assert from "node:assert/strict";
import {needsLiveRead,priority} from "./ops-public-live-flow-optimized.js";
import {setFlightAwareEnabled} from "./fa-policy.js";setFlightAwareEnabled(true);   // FlightAware est arrêté par défaut ; ces tests vérifient sa logique quand il est rallumé
test("vol arrivé sans ATD : toujours à relire ; complet : non", () => {
  const full={ata:"13:00",reg:"YU-APU",aircraft:"320"};
  assert.equal(needsLiveRead("2026-10-08","2026-10-08",{flight:"JU241",...full}),true);
  assert.equal(needsLiveRead("2026-10-08","2026-10-08",{flight:"IZ742",...full}),true);                // plus de liste de compagnies
  assert.equal(needsLiveRead("2026-10-08","2026-10-08",{flight:"JU241",atd:"10:30",...full}),false);
});
test("priorité : vol arrivé sans ATD en tête (0,2), pas s'il a un ATD ni lu il y a moins de 10 min", () => {
  const now=Date.parse("2026-10-08T11:30:00Z"),done={flight:"IZ742",std:"10:00",takeoff:"10:49",landing:"12:50",ata:"13:00"};
  assert.equal(priority({std:"10:00",flight_date:"2026-10-08"},done,810,now)[0],0.2);
  assert.equal(priority({std:"10:00",flight_date:"2026-10-08"},{...done,atd:"10:30"},810,now)[0]===0.2,false);
  assert.equal(priority({std:"10:00",flight_date:"2026-10-08"},{...done,publicLiveBackfill:{checkedAt:new Date(now-3*60000).toISOString()}},810,now)[0]===0.2,false);
});
