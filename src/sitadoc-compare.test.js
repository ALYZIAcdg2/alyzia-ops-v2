import test from "node:test";
import assert from "node:assert/strict";
import {compareSitadoc,sitadocTypes,normGate} from "./sitadoc-compare.js";
test("comparaison Sitadoc : identiques, différents, ATD, TSAT",()=>{
  const r=compareSitadoc([
    {flight:"TK1830",std:"07:20",reg:"TC-LTB",gate:"32",aircraft:"32Q",atd:"07:21",atdSource:"SITADOC",sitadoc:{at:"2026-10-07T05:00:00Z",reg:"TCLTB",gate:"32",type:"32Q",code:"QTN",tsat:"07:20"}},
    {flight:"LO334",std:"07:05",reg:"SP-LVA",gate:"D68",aircraft:"7M8",etd:"07:19",atd:"07:30",atdSource:"PUBLIC_LIVE:FLIGHTSTATS",sitadoc:{at:"2026-10-07T05:10:00Z",reg:"SPLVA",gate:"D69",type:"7M8",code:"HDB",tsat:"07:39"}},
    {flight:"AF1"}
  ]);
  assert.equal(r.flights,3);assert.equal(r.withSitadoc,2);assert.deepEqual(r.identical,{reg:2,gate:1,type:2});
  assert.equal(r.different.gate.length,1);assert.deepEqual([r.different.gate[0].flight,r.different.gate[0].ours,r.different.gate[0].sitadoc],["LO334","D68","D69"]);assert.equal(r.atd.fromSitadoc,1);assert.deepEqual(r.atd.other,[{flight:"LO334",ours:"07:30",source:"PUBLIC_LIVE:FLIGHTSTATS"}]);
  assert.deepEqual(r.tsatLater,[{flight:"LO334",std:"07:05",tsat:"07:39",etd:"07:19"}]);assert.equal(r.lastAt,"2026-10-07T05:10:00Z");
});

test("types Sitadoc collés et portes bus : formats normalisés",()=>{
  assert.deepEqual(sitadocTypes("32032A"),["320","32A"]);assert.deepEqual(sitadocTypes("7M8320"),["7M8","320"]);assert.deepEqual(sitadocTypes("320 319"),["320","319"]);assert.deepEqual(sitadocTypes("32Q"),["32Q"]);assert.deepEqual(sitadocTypes(""),[]);
  assert.equal(normGate("05/BUS"),normGate("5"));assert.equal(normGate("11/BUS"),normGate("11"));assert.notEqual(normGate("04/BUS"),normGate("2"));assert.equal(normGate("D69"),"D69");
});
test("comparaison réelle du 07/10 : seuls les vrais écarts restent",()=>{
  const f=(flight,over,sit)=>({flight,...over,sitadoc:{at:"2026-10-07T04:40:00Z",...sit}});
  const r=compareSitadoc([
    f("BJ511",{gate:"5"},{gate:"05/BUS"}),f("IZ742",{gate:"2"},{gate:"04/BUS"}),
    f("BJ509",{aircraft:"320"},{type:"32032A"}),f("AH1003",{aircraft:"320"},{type:"7M8320"}),f("TK1826",{aircraft:"N32"},{type:"32Q"}),f("DE4264",{aircraft:"321"},{type:"32B"}),
    f("SK834",{aircraft:"320"},{type:"32N"}),f("KU168",{aircraft:"339"},{type:"32Q"}),
    f("SK564",{reg:"EI-GED",regSource:"PUBLIC_LIVE:FR24BOARD"},{reg:"EIHSA"})
  ]);
  assert.deepEqual(r.different.gate.map(d=>d.flight),["IZ742"]);assert.deepEqual(r.different.type.map(d=>d.flight),["SK834","KU168"]);
  assert.equal(r.different.reg[0].oursSource,"PUBLIC_LIVE:FR24BOARD");assert.equal(r.identical.gate,1);assert.equal(r.identical.type,4);
});
