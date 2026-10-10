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

test("an ETD after midnight for an evening STD is tomorrow, not passed",()=>{
  const late={date:"2026-10-04",hhmm:"23:50"};
  assert.notEqual(classify(row({std:"22:35",etd:"00:56",gate:"26",reg:"9V-SJD"}),late).state,"À CONTRÔLER");
  assert.equal(classify(row({std:"21:00",etd:"23:10"}),late).state,"À CONTRÔLER");
});

test("TO et LDG sont renvoyés et signalés manquants : TO pour un vol parti, LDG pour un vol posé",()=>{
  const n={date:"2026-10-10",hhmm:"15:00"};
  const mk=x=>({row:{flight_date:"2026-10-10",flight_number:"XX1",std:"07:20"},x:{flight:"XX1",std:"07:20",sta:"12:00",gate:"19",reg:"TC-LSR",aircraftActual:"32Q",...x}});
  // TK1830 : ATD réel, pas de TO
  const tk=classify(mk({atd:"10:56",status:"PARTI"}),n);
  assert.ok(tk.missing.includes("TO"));assert.equal(tk.takeoff,"");
  // posé avec ATA mais sans LDG
  const arr=classify(mk({atd:"08:10",takeoff:"08:21",ata:"09:23",status:"ARRIVÉE"}),n);
  assert.ok(arr.missing.includes("LDG"));assert.ok(!arr.missing.includes("TO"));assert.equal(arr.takeoff,"08:21");
  // complet : TO, LDG, ATA, ATD
  const ok=classify(mk({atd:"08:10",takeoff:"08:21",landing:"09:15",ata:"09:23",status:"ARRIVÉE"}),n);
  assert.deepEqual(ok.missing,[]);assert.equal(ok.state,"OK");assert.equal(ok.landing,"09:15");
  // en vol : TO attendu, LDG pas encore dû
  const fl=classify(mk({atd:"08:10",takeoff:"08:21",status:"EN VOL"}),n);
  assert.ok(!fl.missing.includes("LDG"));assert.ok(!fl.missing.includes("TO"));
});
