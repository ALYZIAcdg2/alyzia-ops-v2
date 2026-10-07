import test from "node:test";
import assert from "node:assert/strict";
import {setManualBoarding} from "./manual-boarding.js";
function fakeEnv(x){const row={identity:"i1",flight_date:"2026-10-07",flight_number:"LY328",data_json:JSON.stringify(x)};const written=[];
  return {written,OPS_DB:{prepare:sql=>({bind:(...a)=>({all:async()=>({results:[row]}),run:async()=>{written.push(JSON.parse(a[0]));return {}}})})}}}
const base={flight:"LY328",std:"17:35",sta:"22:55",destination:"TLV",dest:"TLV",origin:"CDG"};
test("embarquement manuel : phase MANUAL et statut recalculé",async()=>{
  const env=fakeEnv({...base});const r=await setManualBoarding(env,{date:"2026-10-07",flight:"LY328",phase:"EMBARQUEMENT"});
  assert.equal(r.ok,true);assert.equal(r.status,"EMBARQUEMENT");const w=env.written[0];assert.equal(w.parisAeroportPhase,"EMBARQUEMENT");assert.equal(w.parisAeroportPhaseSource,"MANUAL");
  const r2=await setManualBoarding(fakeEnv({...base}),{date:"2026-10-07",flight:"LY328",phase:"EMBARQUEMENT CLOS"});assert.equal(r2.status,"EMBARQUEMENT CLOS");
});
test("effacer retire la phase ; vol déjà parti refusé ; phase invalide refusée",async()=>{
  const env=fakeEnv({...base,parisAeroportPhase:"EMBARQUEMENT",parisAeroportPhaseSource:"MANUAL"});
  const r=await setManualBoarding(env,{date:"2026-10-07",flight:"LY328",phase:"CLEAR"});assert.equal(r.ok,true);assert.equal(env.written[0].parisAeroportPhase,undefined);
  assert.equal((await setManualBoarding(fakeEnv({...base,atd:"17:40"}),{date:"2026-10-07",flight:"LY328",phase:"EMBARQUEMENT"})).error,"ALREADY_DEPARTED");
  assert.equal((await setManualBoarding(fakeEnv({...base}),{date:"2026-10-07",flight:"LY328",phase:"X"})).error,"BAD_PHASE");
});
