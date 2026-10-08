import test from "node:test";
import assert from "node:assert/strict";
import {flightAwareWanted} from "./flightaware-exact-history.js";
const now=Date.parse("2026-10-07T08:00:00Z"); // 10:00 Paris
test("FlightAware : jamais pour un vol complet ou pas encore à l'heure", () => {
  assert.equal(flightAwareWanted("2026-10-07","10:40",{},now),false);                       // pas parti, STD dans 40 min
  assert.equal(flightAwareWanted("2026-10-07","10:40",{gate:"F1",reg:"F-HABC"},now),false);
  assert.equal(flightAwareWanted("2026-10-07","08:00",{atd:"08:05",ata:"10:00"},now),false); // arrivé et complet
});
test("FlightAware : ATD uniquement, seulement tant qu'il manque", () => {
  assert.equal(flightAwareWanted("2026-10-07","09:30",{},now),true);                         // STD passée, pas d'ATD
  assert.equal(flightAwareWanted("2026-10-07","08:00",{takeoff:"08:20"},now),true);          // parti, ATD manquant
  assert.equal(flightAwareWanted("2026-10-07","08:00",{ata:"10:00"},now),true);              // arrivé sans ATD
  assert.equal(flightAwareWanted("2026-10-07","08:00",{atd:"08:05"},now),false);             // ATD connu : plus jamais lu, même sans arrivée
  assert.equal(flightAwareWanted("2026-10-07","08:00",{atd:"08:05",ata:"10:00"},now),false);
});
test("FlightAware : pas plus d'une lecture toutes les 10 min par vol", () => {
  const x={flightAwareExactHistory:{checkedAt:new Date(now-5*60000).toISOString()}};
  assert.equal(flightAwareWanted("2026-10-07","09:30",x,now),false);
  assert.equal(flightAwareWanted("2026-10-07","09:30",{flightAwareExactHistory:{checkedAt:new Date(now-11*60000).toISOString()}},now),true);
});
