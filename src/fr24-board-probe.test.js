import test from "node:test";
import assert from "node:assert/strict";
import {summarizeFlights,probeFr24Board} from "./fr24-board-probe.js";
const flights=[
 {flightNumber:"AF1",status:{name:"departed",text:"Departed 10:05"},scheduledTime:1760000000,estimatedTime:1760000300,gate:"F1"},
 {flightNumber:"AF2",status:{name:"landed",text:"Landed 12:20"},scheduledTime:1760000000,estimatedTime:1760007000,actualLanding:1760007100},
 {flightNumber:"AF3",status:{name:"scheduled"},scheduledTime:1760009000}];
test("résumé : statuts, atterris et champs de temps", () => {
  const r=summarizeFlights(flights);
  assert.equal(r.total,3);assert.equal(r.statusCounts.landed,1);assert.equal(r.landedCount,1);
  assert.ok(r.flightKeys.includes("gate"));
  assert.equal(r.landedSamples[0].actualLanding.raw,1760007100);
  assert.match(r.landedSamples[0].actualLanding.paris,/^\d{2}\/\d{2} \d{2}:\d{2}$/);
  assert.equal(r.departedSamples.length,1);
});
test("sonde : lecture limitée et refus signalé", async () => {
  const res=await probeFr24Board({nowMs:Date.now()+1e9,fetchImpl:async()=>({status:403,text:async()=>""})});
  assert.equal(res.verdict,"BLOCKED");
  const again=await probeFr24Board({nowMs:Date.now()+1e9+1000,fetchImpl:async()=>({status:403,text:async()=>""})});
  assert.equal(again.status,"THROTTLED");
});
