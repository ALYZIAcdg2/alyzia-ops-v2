import test from "node:test";
import assert from "node:assert/strict";
import {toIata,toSeatmapType,sameAircraft} from "./aircraft-change.js";

test("normalizes provider ICAO codes to Seatmap codes",()=>{
  assert.equal(toSeatmapType("A332"),"332");
  assert.equal(toSeatmapType("B789"),"789");
  assert.equal(toSeatmapType("A21N"),"32Q");
  assert.equal(toSeatmapType("B38M"),"7M8");
});

test("normalizes long manufacturer TYPE labels to Seatmap codes",()=>{
  assert.equal(toIata("Airbus A330-243MRTT"),"332");
  assert.equal(toIata("Airbus A350-941"),"359");
  assert.equal(toIata("Airbus A350-1041"),"351");
  assert.equal(toIata("Boeing 787-9 Dreamliner"),"789");
  assert.equal(toIata("Boeing 777-300ER"),"77W");
  assert.equal(toIata("Boeing 737 MAX 8"),"7M8");
  assert.equal(toIata("Airbus A320-251N"),"32N");
  assert.equal(toIata("Airbus A321-251NX"),"32Q");
  assert.equal(toIata("Airbus A220-300"),"223");
});

test("compares long source TYPE with existing Seatmap TYPE",()=>{
  assert.equal(sameAircraft("332","Airbus A330-243MRTT"),true);
  assert.equal(sameAircraft("789","Boeing 787-9"),true);
  assert.equal(sameAircraft("32Q","Airbus A321-251NX"),true);
});
