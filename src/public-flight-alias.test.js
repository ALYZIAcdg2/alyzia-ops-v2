import test from "node:test";
import assert from "node:assert/strict";
import {flightLookupVariants} from "./public-flight-alias.js";

const designators=(airline,number)=>flightLookupVariants({airline,number}).map(v=>v.designator);

test("flights planned under an ICAO code are also looked up under the IATA code",()=>{
  const d=designators("ENT","777");
  assert.ok(d.includes("ENT777")&&d.includes("E4777"));
  assert.equal(new Set(d).size,d.length);
});
test("airlines of the seatmap catalogue get an ICAO fallback",()=>{
  assert.ok(designators("J2","74").includes("AHY74"));
  assert.ok(designators("PC","5038").includes("PGT5038"));
});
test("existing aliases are unchanged",()=>{
  assert.deepEqual(designators("TK","1822"),["TK1822","THY1822"]);
});
