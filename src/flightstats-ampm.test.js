import test from "node:test";import assert from "node:assert/strict";
import {flightStatsBlockTimes} from "./ops-public-live-flow-optimized.js";
test("FlightStats : heure en 12 h convertie en 24 h (8:51 PM → 20:51)",()=>{
  const r=flightStatsBlockTimes("Scheduled 8:35 PM Estimated 8:46 PM Actual 8:51 PM");
  assert.deepEqual(r,{scheduled:"20:35",estimated:"20:46",actual:"20:51"});
  assert.equal(flightStatsBlockTimes("Actual 12:05 AM").actual,"00:05");
  assert.equal(flightStatsBlockTimes("Actual 12:05 PM").actual,"12:05");
});
test("FlightStats : heure en 24 h inchangée, sans AM/PM rien n'est deviné",()=>{
  assert.equal(flightStatsBlockTimes("Scheduled 20:40 Actual 20:53").actual,"20:53");
  assert.equal(flightStatsBlockTimes("Actual 8:51").actual,"8:51");
  assert.equal(flightStatsBlockTimes("Scheduled 20:40 Actual --").actual,"");
});
