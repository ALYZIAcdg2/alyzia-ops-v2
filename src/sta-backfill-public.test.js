import test from "node:test";
import assert from "node:assert/strict";
import {parseFlightStatsScheduledArrival} from "./sta-backfill-public.js";

test("extracts scheduled arrival in 24h format",()=>{
  const text="Flight Departure Times 03-Oct-2026 Scheduled 07:20 Flight Arrival Times Scheduled 12:00 Actual --";
  assert.equal(parseFlightStatsScheduledArrival(text),"12:00");
});

test("converts FlightStats AM/PM scheduled arrival",()=>{
  const text="Flight Arrival Times Scheduled 9:05 PM +03 Estimated -- Actual --";
  assert.equal(parseFlightStatsScheduledArrival(text),"21:05");
});

test("does not guess without the arrival section",()=>{
  assert.equal(parseFlightStatsScheduledArrival("Scheduled 07:20"),"");
});
