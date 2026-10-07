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

test("withIcaoFallback : un refus 403 / 429 arrête les variantes d'écriture du vol (une seule requête)",async()=>{
  const {withIcaoFallback}=await import("./public-flight-alias.js");
  const seen=[];
  const out=await withIcaoFallback({airline:"VF",number:"12",designator:"VF12",date:"2026-10-07"},c=>`https://x/${c.airline}/${c.number}`,async c=>{seen.push(c.designator);return {status:"HTTP_ERROR",httpStatus:403,url:`https://x/${c.airline}/${c.number}`}});
  assert.equal(seen.length,1);assert.equal(out.status,"HTTP_ERROR");
  const seen2=[];
  await withIcaoFallback({airline:"VF",number:"12",designator:"VF12",date:"2026-10-07"},c=>`https://x/${c.airline}/${c.number}`,async c=>{seen2.push(c.designator);return {status:"NOT_TRACKED",httpStatus:200,url:`https://x/${c.airline}/${c.number}`}});
  assert.ok(seen2.length>1); // pas de refus : les autres écritures sont toujours essayées
});
