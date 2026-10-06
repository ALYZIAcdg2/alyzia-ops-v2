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
  assert.equal(r.etd.flagged,1);assert.equal(r.flaggedFlights.length,1);
});
