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
test("FlightAware : toutes les lectures actives sont filtrées par la politique", () => {
  assert.match(rd("./etd-public-flow.js"),/r===flightAware&&!flightAwareAirlineAllowed\(f\.designator\)/);          // ETD
  assert.match(rd("./sta-public-fallbacks.js"),/read===flightAware&&!flightAwareAirlineAllowed\(flight\.designator\)/);  // STA
  assert.match(rd("./ground-public-flow.js"),/source==="FLIGHTAWARE"&&!flightAwareAirlineAllowed\(f\.designator\)/);     // porte
  assert.match(rd("./flightaware-exact-history.js"),/flightAwareAllowed\(designator\(row,x\),x\)/);                      // pages connues
  assert.match(rd("./ops-public-live-flow-optimized.js"),/onDemand\|\|flightAwareAllowed\(f\.designator,base\)/);        // lecture par vol
});
