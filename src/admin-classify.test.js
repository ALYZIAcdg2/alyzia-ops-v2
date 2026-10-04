import test from "node:test";
import assert from "node:assert/strict";
import {classify} from "./admin-dashboard-native-wrapper.js";

const now={date:"2026-10-04",hhmm:"10:30"};
const row=(x)=>({row:{flight_date:"2026-10-04",flight_number:"XX1",std:x.std},x:{flight:"XX1",sta:"14:00",...x}});

test("a flight whose STD is still ahead is never to be checked, even without ETD",()=>{
  assert.notEqual(classify(row({std:"10:45"}),now).state,"À CONTRÔLER");
  assert.notEqual(classify(row({std:"11:00"}),now).state,"À CONTRÔLER");
});
test("STD passed without ETD or ATD is to be checked",()=>{
  assert.equal(classify(row({std:"05:00"}),now).state,"À CONTRÔLER");
  assert.equal(classify(row({std:"10:20"}),now).state,"À CONTRÔLER");
});
test("ETD passed without ATD is to be checked, ETD ahead is not",()=>{
  assert.equal(classify(row({std:"10:00",etd:"10:15"}),now).state,"À CONTRÔLER");
  assert.notEqual(classify(row({std:"10:00",etd:"10:50"}),now).state,"À CONTRÔLER");
});
test("a departed flight with ATD is not to be checked",()=>{
  assert.notEqual(classify(row({std:"09:00",atd:"09:05"}),now).state,"À CONTRÔLER");
});
