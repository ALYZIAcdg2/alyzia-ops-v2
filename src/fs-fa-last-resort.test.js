import test from "node:test";
import assert from "node:assert/strict";
import {farFromDeparture} from "./ops-public-live-flow-optimized.js";
// 2026-10-07 13:47 à Paris = 11:47 UTC
const now=Date.parse("2026-10-07T11:47:00Z");
test("dernier secours : STD passée = pastStd (fenêtre 0)",()=>{
  assert.equal(farFromDeparture("2026-10-07","10:20",{},now,0),false);
  assert.equal(farFromDeparture("2026-10-07","13:47",{},now,0),false);
});
test("dernier secours : STD à venir = pas encore",()=>{
  assert.equal(farFromDeparture("2026-10-07","13:48",{},now,0),true);
  assert.equal(farFromDeparture("2026-10-07","15:00",{},now,0),true);
});
