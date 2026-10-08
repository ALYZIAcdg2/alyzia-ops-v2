import test from "node:test";
import assert from "node:assert/strict";
import {priority} from "./ops-public-live-flow-optimized.js";
const now=Date.parse("2026-10-08T08:00:00Z");
const full={std:"11:20",gate:"F27",reg:"F-HABC",aircraft:"A321",etd:"11:20"};
test("départ proche avec info manquante : lu en premier", () => {
  assert.equal(priority({std:"11:20"},{...full,reg:""},600,now)[0],-1);   // STD dans 80 min, immat manquante
  assert.equal(priority({std:"11:20"},{...full,gate:""},600,now)[0],-1);
  assert.equal(priority({std:"11:20"},{...full,etd:""},640,now)[0],-1);   // ETD manquant à moins de 45 min
});
test("rien ne manque, ou trop loin, ou lu il y a moins de 4 min : ordre habituel", () => {
  assert.notEqual(priority({std:"11:20"},full,600,now)[0],-1);
  assert.notEqual(priority({std:"11:20"},{...full,reg:""},500,now)[0],-1); // STD dans plus de 90 min
  assert.notEqual(priority({std:"11:20"},{...full,reg:"",publicLiveBackfill:{checkedAt:new Date(now-60000).toISOString()}},600,now)[0],-1);
  assert.notEqual(priority({std:"11:20"},{...full,reg:"",atd:"11:25"},690,now)[0],-1); // déjà parti
});
