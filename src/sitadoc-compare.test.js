import test from "node:test";
import assert from "node:assert/strict";
import {compareSitadoc} from "./sitadoc-compare.js";
test("comparaison Sitadoc : identiques, différents, ATD, TSAT",()=>{
  const r=compareSitadoc([
    {flight:"TK1830",std:"07:20",reg:"TC-LTB",gate:"32",aircraft:"32Q",atd:"07:21",atdSource:"SITADOC",sitadoc:{at:"2026-10-07T05:00:00Z",reg:"TCLTB",gate:"32",type:"32Q",code:"QTN",tsat:"07:20"}},
    {flight:"LO334",std:"07:05",reg:"SP-LVA",gate:"D68",aircraft:"7M8",etd:"07:19",atd:"07:30",atdSource:"PUBLIC_LIVE:FLIGHTSTATS",sitadoc:{at:"2026-10-07T05:10:00Z",reg:"SPLVA",gate:"D69",type:"7M8",code:"HDB",tsat:"07:39"}},
    {flight:"AF1"}
  ]);
  assert.equal(r.flights,3);assert.equal(r.withSitadoc,2);assert.deepEqual(r.identical,{reg:2,gate:1,type:2});
  assert.deepEqual(r.different.gate,[{flight:"LO334",ours:"D68",sitadoc:"D69"}]);assert.equal(r.atd.fromSitadoc,1);assert.deepEqual(r.atd.other,[{flight:"LO334",ours:"07:30",source:"PUBLIC_LIVE:FLIGHTSTATS"}]);
  assert.deepEqual(r.tsatLater,[{flight:"LO334",std:"07:05",tsat:"07:39",etd:"07:19"}]);assert.equal(r.lastAt,"2026-10-07T05:10:00Z");
});
