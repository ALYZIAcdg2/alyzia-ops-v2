import test from "node:test";
import assert from "node:assert/strict";
import {plausibleAtd,indexFeed,pickFeedRow,sweepFidsToday} from "./fids-atd-sweep.js";
test("ATD plausible : pas futur, pas après décollage, pas trop avant STD",()=>{
  assert.equal(plausibleAtd("12:47",{std:"12:25",takeoff:"13:08",nowMin:840}),true);
  assert.equal(plausibleAtd("13:20",{std:"12:25",takeoff:"13:08",nowMin:840}),false);
  assert.equal(plausibleAtd("15:00",{std:"12:25",nowMin:840}),false);
  assert.equal(plausibleAtd("10:00",{std:"12:25",nowMin:840}),false);
});
test("ligne du flux : même vol et même STD, vol opérant d'abord",()=>{
  const rows=[{flight_iata:"UU8828",cs_flight_iata:"AF1828",dep_time:"2026-10-06 12:15"},{flight_iata:"AF1828",dep_time:"2026-10-06 12:15"},{flight_iata:"AF1828",dep_time:"2026-10-05 12:15"}];
  const i=indexFeed(rows,"2026-10-06");assert.equal(pickFeedRow(i,{designator:"AF1828",std:"12:15"}).flight_iata,"AF1828");assert.equal(pickFeedRow(i,{designator:"AF1828",std:"09:00"}),null);
});
function fakeDb(flights){const updates=[];return {updates,OPS_DB:{prepare:sql=>({bind:(...a)=>({all:async()=>({results:flights}),run:async()=>{updates.push(JSON.parse(a[0]))}})})}}}
test("écrit l'ATD manquant, respecte manuel et ATD déjà présent",async()=>{
  const mk=(n,d)=>({identity:n,flight_number:n.slice(2),airline:n.slice(0,2),std:"12:25",data_json:JSON.stringify({airline:n.slice(0,2),flight:n,std:"12:25",origin:"CDG",...d})});
  const env=fakeDb([mk("TK1832",{takeoff:"13:08"}),mk("AF1",{atd:"12:40",atdSource:"PUBLIC_LIVE:FLIGHTSTATS"}),mk("KL2",{atd:"12:30",atdSource:"MANUAL"})]);
  const rows=["TK1832","AF1","KL2"].map(f=>({flight_iata:f,dep_time:"2026-10-06 12:25",dep_actual:"2026-10-06 12:47"}));
  const nowMs=Date.parse("2026-10-06T12:30:00Z")+0; // 14:30 Paris
  const r=await sweepFidsToday(env,{nowMs,fetchImpl:async()=>new Response(JSON.stringify(rows),{status:200})});
  assert.equal(r.updated,1);assert.equal(env.updates[0].atd,"12:47");assert.equal(env.updates[0].atdSource,"PUBLIC_LIVE:FIDS");
});
