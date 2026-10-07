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

test("browser conversion source matches the server conversion",async()=>{
  const {clientSeatmapTypeSource,configCodes}=await import("./aircraft-change.js");
  const client=(0,eval)(clientSeatmapTypeSource());
  for(const v of ["A332","B789","Airbus A350-900","Boeing 777-300ER","A21N","738","73H","","N32","Airbus A220-300","unknown"])assert.equal(client.toIata(v),toIata(v),v);
  for(const v of ["738","772","32Q","359","","321"])assert.deepEqual(client.configCodes(v),configCodes(v),v);
});
import {configCodes as __configCodes} from "./aircraft-change.js";
test("TK : 738 et 7M8 retrouvent le plan 78D, 7M9 le plan 79D",()=>{
  assert.ok(__configCodes("738").includes("78D"));assert.ok(__configCodes("7M8").includes("78D"));assert.ok(__configCodes("7M9").includes("79D"));
  assert.ok(__configCodes("78D").includes("7M8"));
});
