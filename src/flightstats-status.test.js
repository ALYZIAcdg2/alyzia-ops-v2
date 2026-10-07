import test from "node:test";
import assert from "node:assert/strict";
import {summarizeFlightStats} from "./flightstats-status.js";
const now=Date.parse("2026-10-07T04:00:00Z"); // 06:00 à Paris
test("résumé : id connu, dernière lecture, vols de la fenêtre jamais lus",()=>{
  const rows=[
    {flight:"AF1",std:"07:00",flightStatsId:"123",atd:"",publicLiveBackfill:{attempts:[{source:"FLIGHTSTATS",status:"OK",httpStatus:200,checkedAt:"2026-10-07T03:50:00Z"}]}},
    {flight:"AF2",std:"06:30",atd:""},
    {flight:"AF3",std:"15:00"},
    {flight:"AF4",std:"07:10",atdSource:"PUBLIC_LIVE:FLIGHTSTATS",flightStatsRefusedAt:"2026-10-07T03:00:00Z",publicLiveBackfill:{attempts:[{source:"FLIGHTSTATS",status:"HTTP_ERROR",httpStatus:403,checkedAt:"2026-10-07T01:00:00Z"}]}}
  ];
  const r=summarizeFlightStats(rows,{nowMs:now});
  assert.equal(r.flights,4);assert.equal(r.idKnown,1);assert.equal(r.readThisHour,1);assert.equal(r.neverRead,2);assert.equal(r.atdFromFS,1);assert.equal(r.refusedFlag,1);
  assert.deepEqual(r.inWindowNotRead,["AF2 06:30"]);assert.equal(r.lastStatus["OK 200"],1);assert.equal(r.lastStatus["HTTP_ERROR 403"],1);
});
