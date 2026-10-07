import test from "node:test";
import assert from "node:assert/strict";
import {cleanSitadocFlight,cleanupSitadoc} from "./sitadoc-cleanup.js";
test("nettoyage d'un vol : bloc, heures de source Sitadoc et journal ; le reste est intact",()=>{
  const x={std:"07:20",sta:"11:00",reg:"TC-LTB",gate:"32",atd:"07:21",atdSource:"SITADOC",atdUpdatedAt:"t",takeoff:"07:34",takeoffSource:"PUBLIC_LIVE:FR24BOARD",eta:"10:45",etaSource:"SITADOC_MVT",
    sitadoc:{reg:"TCLTB"},flightInfoLog:[{source:"SITADOC",field:"atd"},{source:"PUBLIC_LIVE:FIDS",field:"ata"},{source:"SITADOC_MVT",field:"eta"}]};
  const r=cleanSitadocFlight(x);
  assert.deepEqual([r.removedBlock,r.fieldsCleared,r.logRemoved,r.changed],[true,["atd","eta"],2,true]);
  assert.equal(x.sitadoc,undefined);assert.equal(x.atd,undefined);assert.equal(x.atdSource,undefined);assert.equal(x.eta,undefined);
  assert.deepEqual([x.std,x.sta,x.reg,x.gate,x.takeoff,x.takeoffSource],["07:20","11:00","TC-LTB","32","07:34","PUBLIC_LIVE:FR24BOARD"]);
  assert.equal(x.flightInfoLog.length,1);assert.equal(x.flightInfoLog[0].source,"PUBLIC_LIVE:FIDS");
  assert.equal(cleanSitadocFlight({std:"07:20"}).changed,false);
});
test("route de nettoyage : essai à blanc sans écriture, puis application",async()=>{
  const rows=[{identity:"1",flight_date:"2026-10-07",flight_number:"TK1830",data_json:JSON.stringify({atd:"07:21",atdSource:"SITADOC",sitadoc:{reg:"X"}})},{identity:"2",flight_date:"2026-10-07",flight_number:"AF1",data_json:JSON.stringify({std:"08:00"})}];
  const writes=[];const env={OPS_DB:{prepare:q=>({bind:(...a)=>({run:async()=>{writes.push(a)}}),all:async()=>({results:q.includes("SELECT")?rows:[]})})}};
  const dry=await cleanupSitadoc(env);assert.equal(dry.mode,"SITADOC_CLEANUP_DRY_RUN");assert.equal(dry.cleaned,1);assert.equal(dry.blocks,1);assert.deepEqual(dry.fields,{atd:1});assert.equal(writes.length,0);
  const done=await cleanupSitadoc(env,{apply:true});assert.equal(done.mode,"SITADOC_CLEANUP_APPLIED");assert.equal(writes.length,1);
  const saved=JSON.parse(writes[0][0]);assert.equal(saved.sitadoc,undefined);assert.equal(saved.atd,undefined);
});
