import test from "node:test";import assert from "node:assert/strict";
import {priority,pickSlots,etaOverdueMin} from "./ops-public-live-flow-optimized.js";
const now=Date.parse("2026-10-09T20:00:00Z"),iso=min=>new Date(now+min*60000).toISOString();
const dep={std:"18:00",atd:"18:05",takeoff:"18:15"};
test("vol parti dont l'ETA est dépassée de 15 min sans LDG ni ATA : rang 0,1, avant tout vol plus lointain",()=>{
  const x={...dep,statusArrivalUtc:iso(-30)};
  assert.equal(priority({std:"18:00"},x,1100,now)[0],0.1);
  assert.ok(priority({std:"18:00"},x,1100,now)[0]<priority({std:"22:00"},{std:"22:00"},1100,now)[0]);
  assert.ok(priority({std:"18:00"},x,1100,now)[0]<1);   // avant les vols simplement en l'air
});
test("pas avant 15 min de dépassement, ni avec un LDG / une ATA déjà connus, ni sans départ",()=>{
  assert.notEqual(priority({std:"18:00"},{...dep,statusArrivalUtc:iso(-10)},1100,now)[0],0.1);
  assert.notEqual(priority({std:"18:00"},{...dep,statusArrivalUtc:iso(-30),landing:"19:20"},1100,now)[0],0.1);
  assert.notEqual(priority({std:"18:00"},{...dep,statusArrivalUtc:iso(-30),ata:"19:30"},1100,now)[0],0.1);
  assert.notEqual(priority({std:"18:00"},{std:"18:00",statusArrivalUtc:iso(-30)},1100,now)[0],0.1);
});
test("délai entre deux lectures : 6 min (jusqu'à 2 h), 15 min (jusqu'à 6 h), 1 h au-delà",()=>{
  const at=(over,agoMin)=>priority({std:"18:00"},{...dep,statusArrivalUtc:iso(-over),publicLiveBackfill:{checkedAt:iso(-agoMin)}},1100,now)[0]===0.1;
  assert.equal(at(60,5),false);assert.equal(at(60,7),true);
  assert.equal(at(200,10),false);assert.equal(at(200,16),true);
  assert.equal(at(500,40),false);assert.equal(at(500,61),true);
});
test("etaOverdueMin : null sans heure d'arrivée du modèle",()=>{assert.equal(etaOverdueMin({},now),null);assert.equal(Math.round(etaOverdueMin({statusArrivalUtc:iso(-30)},now)),30)});
