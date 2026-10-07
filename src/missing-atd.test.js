import test from "node:test";
import assert from "node:assert/strict";
import {missingAtd,lastAttempt} from "./missing-atd.js";
const now=Date.parse("2026-10-07T11:25:00Z"); // 13:25 à Paris
test("vols partis sans ATD : état FIDS, FlightStats, FlightAware",()=>{
  const rows=[
    {flight:"EI521",std:"10:20",etd:"10:30",landing:"10:51",ata:"10:55",flightStatsId:"123",publicLiveBackfill:{attempts:[{source:"FLIGHTSTATS",status:"HTTP_ERROR",httpStatus:403},{source:"FLIGHTAWARE",status:"HTTP_429",httpStatus:429}]}},
    {flight:"AF1",std:"10:00",atd:"10:05"},
    {flight:"SK564",std:"13:15"},
    {flight:"LO1",std:"09:50"}
  ];
  const r=missingAtd(rows,{nowMs:now,fids:{flights:{"EI521|10:20":"NO_USABLE_DATA"}}});
  assert.deepEqual(r.map(x=>x.flight),["LO1","EI521"]);
  const e=r.find(x=>x.flight==="EI521");assert.equal(e.fids,"NO_USABLE_DATA");assert.equal(e.flightstats,"HTTP_ERROR 403");assert.equal(e.flightaware,"HTTP_429 429");assert.equal(e.flightStatsId,true);
  assert.equal(r.find(x=>x.flight==="LO1").fids,"absent de l'état");assert.equal(lastAttempt({},"FLIGHTSTATS"),"jamais lu");
});
