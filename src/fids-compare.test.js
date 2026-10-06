import test from "node:test";
import assert from "node:assert/strict";
import {compareFlights} from "./fids-compare.js";
test("compare ATD, décollage et porte au flux",()=>{
  const rows=[{flight_iata:"AF1828",dep_time:"2026-10-06 12:15",dep_actual:"2026-10-06 12:11",dep_gate:"F28"},{flight_iata:"KL1",dep_time:"2026-10-06 13:00",dep_actual:"2026-10-06 13:20",dep_gate:"A1"}];
  const r=compareFlights([{designator:"AF1828",std:"12:15",atd:"12:10",takeoff:"12:20",gate:"F28"},{designator:"KL1",std:"13:00",atd:"",takeoff:"13:25",gate:"B2"},{designator:"XX9",std:"10:00"}],rows);
  assert.equal(r.matched,2);assert.equal(r.bothAtd,1);assert.equal(r.vsAtd["0..1"],1);
  assert.equal(r.gain,1);assert.equal(r.gateSame,1);assert.equal(r.examples.gateDiff.length,1);
});
import {runFidsCompare} from "./fids-compare.js";
test("mode explication : lignes du flux et nos valeurs pour un vol",async()=>{
  const env={OPS_DB:{prepare:()=>({bind:()=>({all:async()=>({results:[{flight_number:"9628",airline:"A9",std:"15:40",data_json:JSON.stringify({airline:"A9",flight:"A9628",std:"15:40",takeoff:"16:32"})}]})})})}};
  const rows=[{flight_iata:"A9628",dep_time:"2026-10-06 15:40",dep_actual:"",status:"active"}];
  const r=await runFidsCompare(env,{flight:"a9628",nowMs:Date.parse("2026-10-06T14:40:00Z"),fetchImpl:async()=>new Response(JSON.stringify(rows),{status:200})});
  assert.equal(r.explain.ours[0].takeoff,"16:32");assert.equal(r.explain.feed[0].dep_actual,"");
});
test("explication : décision du passage FIDS pour un vol",async()=>{
  const mk=(std,extra={})=>({flight_number:"1063",airline:"AH",std,data_json:JSON.stringify({airline:"AH",flight:"AH1063",origin:"CDG",std,takeoff:"20:46",...extra})});
  const mkEnv=rowsDb=>({OPS_DB:{prepare:q=>({bind:()=>({all:async()=>({results:rowsDb}),first:async()=>null})})}});
  const feed=[{flight_iata:"AH1063",dep_time:"2026-10-06 20:00",dep_actual:"2026-10-06 20:30",dep_time_ts:Date.parse("2026-10-06T18:00:00Z")/1000,dep_actual_ts:Date.parse("2026-10-06T18:30:00Z")/1000,status:"active"}];
  const run=env=>runFidsCompare(env,{flight:"ah1063",nowMs:Date.parse("2026-10-06T20:00:00Z"),fetchImpl:async()=>new Response(JSON.stringify(feed),{status:200})});
  assert.match((await run(mkEnv([mk("20:00")]))).explain.decisions[0].reason,/DEVRAIT/);
  assert.match((await run(mkEnv([mk("20:10")]))).explain.decisions[0].reason,/DEVRAIT/);assert.match((await run(mkEnv([mk("21:30")]))).explain.decisions[0].reason,/aucune ligne/);
  assert.match((await run(mkEnv([mk("20:00",{atd:"20:31",atdSource:"PUBLIC_LIVE:FLIGHTSTATS"})]))).explain.decisions[0].reason,/autre source/);
  assert.match((await run(mkEnv([mk("20:00",{takeoff:"20:20"})]))).explain.decisions[0].reason,/DEVRAIT|plausibilité/);
});
test("ATA : arr_actual du flux contre notre ATA et notre atterrissage",()=>{
  const rows=[
    {flight_iata:"AH1",dep_time:"2026-10-06 12:00",arr_actual:"2026-10-06 14:10"},
    {flight_iata:"AH2",dep_time:"2026-10-06 12:00",arr_actual:"2026-10-06 14:30"},
    {flight_iata:"AH3",dep_time:"2026-10-06 12:00",arr_actual:"2026-10-06 15:00"},
    {flight_iata:"AH4",dep_time:"2026-10-06 12:00",arr_actual:""}];
  const f=(n,o)=>({designator:"AH"+n,std:"12:00",dest:"ALG",...o});
  const r=compareFlights([f(1,{ata:"14:09"}),f(2,{ata:"14:50",ataSource:"PUBLIC_LIVE:FLIGHTSTATS"}),f(3,{landing:"14:52"}),f(4,{})],rows);
  assert.equal(r.ata.feedActual,3);assert.equal(r.ata.bothAta,2);assert.equal(r.ata.vsAta["0..1"],1);assert.equal(r.ata.gain,1);
  assert.equal(r.ata.vsLanding["4..10"],1);assert.equal(r.ata.examples.diffAta[0].flight,"AH2");assert.equal(r.ata.examples.gain[0].flight,"AH3");
});
