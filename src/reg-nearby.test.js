import test from "node:test";
import assert from "node:assert/strict";
import {sameRegNearby} from "./ops-public-live-flow-optimized.js";
const others=[{std:"12:20",x:{reg:"D-AIHV",origin:"CDG"}},{std:"09:00",x:{reg:"LZ-FSA",origin:"CDG"}}];
test("immatriculation portée par un autre départ CDG à moins de 2 h : refusée",()=>{
  assert.equal(sameRegNearby(others,{reg:"D-AIHV",std:"12:15"}),true);
  assert.equal(sameRegNearby(others,{reg:"d-aihv",std:"13:30"}),true);
});
test("assez éloigné, autre immatriculation ou STD inconnue : acceptée",()=>{
  assert.equal(sameRegNearby(others,{reg:"D-AIHV",std:"15:00"}),false);   // 2 h 40 plus tard : rotation possible
  assert.equal(sameRegNearby(others,{reg:"LZ-FSA",std:"12:15"}),false);
  assert.equal(sameRegNearby(others,{reg:"D-AIHV",std:""}),false);
});
