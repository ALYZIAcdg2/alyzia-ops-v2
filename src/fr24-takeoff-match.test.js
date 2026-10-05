import test from "node:test";
import assert from "node:assert/strict";
import {takeoffMatchesStd} from "./fr24-public-html.js";

const f={date:"2026-10-05",std:"01:30",origin:"CDG",destination:"DJE"};
test("TU655: takeoff 00:13Z (02:13 CEST) matches a 01:30 STD, the previous day's does not",()=>{
  assert.equal(takeoffMatchesStd("2026-10-05T00:13:54.000Z",f),true);
  assert.equal(takeoffMatchesStd("2026-10-03T18:12:28.000Z",f),false);
  assert.equal(takeoffMatchesStd("",f),false);
});
test("without STD the Paris day of the takeoff is used",()=>{
  assert.equal(takeoffMatchesStd("2026-10-05T00:13:54.000Z",{date:"2026-10-05"}),true);
  assert.equal(takeoffMatchesStd("2026-10-04T10:00:00.000Z",{date:"2026-10-05"}),false);
});
