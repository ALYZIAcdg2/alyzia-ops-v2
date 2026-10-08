import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {flightAwareAirlineAllowed,flightAwareAllowed,FA_ONLY_AIRLINES} from "./fa-policy.js";
const rd=f=>fs.readFileSync(new URL(f,import.meta.url),"utf8");
test("FlightAware : politique commune (JU seulement)", () => {
  assert.deepEqual(FA_ONLY_AIRLINES,["JU"]);
  assert.equal(flightAwareAirlineAllowed("JU241"),true);
  assert.equal(flightAwareAirlineAllowed("ju 241"),true);
  assert.equal(flightAwareAirlineAllowed("AT779"),false);
  assert.equal(flightAwareAllowed("JU241",{atd:"10:30"}),false);
});
test("FlightAware : ATD uniquement, JU seulement, dans toutes les lectures actives", () => {
  assert.match(rd("./etd-public-flow.js"),/r===flightAware\)continue/);                  // jamais l'ETD
  assert.match(rd("./sta-public-fallbacks.js"),/read===flightAware\)continue/);         // jamais la STA
  assert.match(rd("./ground-public-flow.js"),/source==="FLIGHTAWARE"\)continue/);        // jamais la porte
  assert.match(rd("./flightaware-exact-history.js"),/flightAwareAllowed\(designator\(row,x\),x\)/);
  assert.match(rd("./flightaware-exact-history.js"),/for\(const field of \["atd"\]\)/);   // pages connues : ATD seul
  assert.match(rd("./ops-public-live-flow-optimized.js"),/map\.FLIGHTAWAREEXACT=\{atd:/);  // lecture par vol : ATD seul
});
