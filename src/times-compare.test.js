import test from "node:test";
import assert from "node:assert/strict";
import {spread,runTimesCompare} from "./times-compare.js";
test("écart maximal entre sources, circulaire sur 24 h",()=>{
  assert.deepEqual(spread({a:"16:00",b:"16:26",c:""}),{sources:2,maxGap:26,flag:true});
  assert.equal(spread({a:"16:00",b:"16:04"}).flag,false);
  assert.equal(spread({a:"23:58",b:"00:03"}).maxGap,5);
  assert.equal(spread({a:"16:00"}).flag,false);
});
test("compare nos valeurs, FIDS et FR24 par vol",async()=>{
  const row={identity:"1",flight_date:"2026-10-06",flight_number:"9628",airline:"A9",std:"15:40",data_json:JSON.stringify({airline:"A9",flight:"A9628",origin:"CDG",destination:"TBS",std:"15:40",etd:"16:00",eta:"22:00"})};
  const env={OPS_DB:{prepare:()=>({bind:()=>({all:async()=>({results:[row]})})})}};
  const feed=[{flight_iata:"A9628",dep_time:"2026-10-06 15:40",dep_estimated:"2026-10-06 16:00",arr_estimated:"2026-10-06 22:00",status:"scheduled"}];
  const fr24=async()=>({candidates:{semantic:{etd:"2026-10-06T14:26:00Z",eta:"2026-10-06T20:26:00Z"}}});
  const r=await runTimesCompare(env,{nowMs:Date.parse("2026-10-06T14:00:00Z"),fr24,fetchImpl:async u=>String(u).includes("fids")?new Response(JSON.stringify(feed),{status:200}):new Response("x",{status:403})});
  const f=r.rows[0];
  assert.equal(f.etd.fr24,"16:26");assert.equal(f.etd.fids,"16:00");assert.equal(f.etd.flag,true);assert.equal(f.etd.maxGap,26);
  assert.equal(r.etdAvantDepart.flagged,1);assert.equal(r.flaggedFlights.length,1);
});
test("par défaut, seuls les vols des 3 dernières heures ou à venir",async()=>{
  const mk=(n,std)=>({identity:n,flight_date:"2026-10-06",flight_number:n,airline:"AF",std,data_json:JSON.stringify({airline:"AF",flight:"AF"+n,origin:"CDG",destination:"LHR",std})});
  const env={OPS_DB:{prepare:()=>({bind:()=>({all:async()=>({results:[mk("1","08:00"),mk("2","15:30"),mk("3","19:00")]})})})}};
  const fr24=async()=>({candidates:{semantic:{}}});const fetchImpl=async()=>new Response("x",{status:403});
  const now=Date.parse("2026-10-06T16:00:00Z"); // 18:00 Paris : fenêtre depuis 15:00
  const r=await runTimesCompare(env,{nowMs:now,fr24,fetchImpl});
  assert.deepEqual(r.rows.map(x=>x.flight),["AF2","AF3"]);
  const a=await runTimesCompare(env,{nowMs:now,fr24,fetchImpl,all:true});
  assert.equal(a.rows.length,3);
});
test("vol parti : décollage et ATD comparés, pas l'ETD",async()=>{
  const row={identity:"1",flight_date:"2026-10-06",flight_number:"1001",airline:"AH",std:"15:30",data_json:JSON.stringify({airline:"AH",flight:"AH1001",origin:"CDG",destination:"ALG",std:"15:30",etd:"15:55",takeoff:"16:35",atd:"16:16"})};
  const env={OPS_DB:{prepare:()=>({bind:()=>({all:async()=>({results:[row]})})})}};
  const feed=[{flight_iata:"AH1001",dep_time:"2026-10-06 15:30",dep_estimated:"2026-10-06 16:16",status:"active"}];
  const r=await runTimesCompare(env,{nowMs:Date.parse("2026-10-06T17:30:00Z"),fr24:async()=>({candidates:{semantic:{}}}),all:true,fetchImpl:async u=>String(u).includes("fids")?new Response(JSON.stringify(feed),{status:200}):new Response("x",{status:403})});
  const f=r.rows[0];assert.equal(f.etd,undefined);assert.equal(f.atd.fids,"16:16");assert.equal(f.atd.flag,false);assert.equal(r.etdAvantDepart.flagged,0);assert.equal(r.fr24Reads.EMPTY,1);
});
test("l'identifiant FR24 du tableau est transmis à la lecture par vol",async()=>{
  let seen=null;
  const row={identity:"1",flight_date:"2026-10-06",flight_number:"789",airline:"AT",std:"18:30",data_json:JSON.stringify({airline:"AT",flight:"AT789",origin:"CDG",destination:"CMN",std:"18:30"})};
  const env={OPS_DB:{prepare:()=>({bind:()=>({all:async()=>({results:[row]})})})}};
  const std=Date.parse("2026-10-06T16:30:00Z")/1000;
  const page=`<div data-page="${JSON.stringify({props:{flights:[{flightNumber:"AT789",status:{name:"estimated"},scheduledTime:std,estimatedTime:std,flightId:"abc123",gate:"A1"}],meta:{hasMoreNextData:false}}}).replace(/&/g,"&amp;").replace(/"/g,"&quot;")}"></div>`;
  await runTimesCompare(env,{nowMs:Date.parse("2026-10-06T18:40:00Z"),all:true,fr24:async f=>{seen=f.raw?.fr24OccurrenceId;return {candidates:{semantic:{}}}},fetchImpl:async u=>String(u).includes("flightradar24")?new Response(page,{status:200}):new Response("x",{status:403})});
  assert.equal(seen,"abc123");
});
