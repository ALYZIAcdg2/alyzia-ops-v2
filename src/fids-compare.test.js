import test from "node:test";
import assert from "node:assert/strict";
import {compareFlights} from "./fids-compare.js";
test("compare ATD, décollage et porte au flux",()=>{
  const rows=[{flight_iata:"AF1828",dep_time:"2026-10-06 12:15",dep_actual:"2026-10-06 12:11",dep_gate:"F28"},{flight_iata:"KL1",dep_time:"2026-10-06 13:00",dep_actual:"2026-10-06 13:20",dep_gate:"A1"}];
  const r=compareFlights([{designator:"AF1828",std:"12:15",atd:"12:10",takeoff:"12:20",gate:"F28"},{designator:"KL1",std:"13:00",atd:"",takeoff:"13:25",gate:"B2"},{designator:"XX9",std:"10:00"}],rows);
  assert.equal(r.matched,2);assert.equal(r.bothAtd,1);assert.equal(r.vsAtd["0..1"],1);
  assert.equal(r.gain,1);assert.equal(r.gateSame,1);assert.equal(r.examples.gateDiff.length,1);
});
