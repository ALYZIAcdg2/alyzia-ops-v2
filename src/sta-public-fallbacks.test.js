import test from "node:test";
import assert from "node:assert/strict";
import {occurrenceMatchesStaPage,parsePublicScheduledArrival} from "./sta-public-fallbacks.js";

const flight={date:"2026-10-03",airline:"TK",number:"1830",designator:"TK1830",origin:"CDG",destination:"IST"};

test("accepts only the dated flight occurrence and route",()=>{
  assert.equal(occurrenceMatchesStaPage("TK1830 CDG IST 03-Oct-2026 Scheduled arrival 12:00",flight),true);
  assert.equal(occurrenceMatchesStaPage("TK1830 CDG IST 02-Oct-2026 Scheduled arrival 12:00",flight),false);
  assert.equal(occurrenceMatchesStaPage("TK1830 CDG AYT 03-Oct-2026 Scheduled arrival 12:00",flight),false);
});

test("extracts labeled scheduled arrival only",()=>{
  assert.equal(parsePublicScheduledArrival("Scheduled arrival 12:00"),"12:00");
  assert.equal(parsePublicScheduledArrival("Arrival Scheduled 9:05 PM"),"21:05");
  assert.equal(parsePublicScheduledArrival("Page clock 03:28"),"");
});
