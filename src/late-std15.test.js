import test from "node:test";
import assert from "node:assert/strict";
import {lateBeyondStd15} from "./late-std15.js";
import {flightOperationalStatus} from "./flight-operational-status.js";
// 2026-10-07 15:00 à Paris (UTC+2) = 13:00 UTC
const at=(hhmm)=>Date.parse(`2026-10-07T${hhmm}:00Z`);
test("avant STD + 15 min : pas en retard sans ETD, ni avec un ETD de moins de 15 min",()=>{
  assert.equal(lateBeyondStd15({std:"20:00"},"2026-10-07",at("13:00")),false);
  assert.equal(lateBeyondStd15({std:"15:00",etd:"15:14"},"2026-10-07",at("13:00")),false);
  assert.equal(lateBeyondStd15({std:"15:00",etd:"15:05"},"2026-10-07",at("13:14")),false);
});
test("ETD supérieur à la STD de 15 min ou plus : RETARDÉ tout de suite (vol du jour)",()=>{
  assert.equal(lateBeyondStd15({std:"20:00",etd:"20:15"},"2026-10-07",at("13:00")),true);
  assert.equal(lateBeyondStd15({std:"20:00",edt:"20:40"},"2026-10-07",at("13:00")),true);
  assert.equal(lateBeyondStd15({std:"23:50",etd:"00:10"},"2026-10-07",at("13:00")),true);   // ETD passé minuit
  assert.equal(lateBeyondStd15({std:"20:00",etd:"20:40"},"2026-10-08",at("13:00")),false);  // vol de demain : inchangé
  assert.equal(lateBeyondStd15({std:"20:00",etd:"19:30"},"2026-10-07",at("13:00")),false);  // ETD plus tôt : pas un retard
});
test("à STD + 15 min et après : en retard",()=>{
  assert.equal(lateBeyondStd15({std:"15:00"},"2026-10-07",at("13:15")),true);
  assert.equal(lateBeyondStd15({std:"15:00"},"2026-10-07",at("13:40")),true);
});
test("vol d'hier non parti : en retard ; vol de demain : non ; STD absente : non",()=>{
  assert.equal(lateBeyondStd15({std:"23:00"},"2026-10-06",at("13:00")),true);
  assert.equal(lateBeyondStd15({std:"00:10"},"2026-10-08",at("13:00")),false);
  assert.equal(lateBeyondStd15({},"2026-10-07",at("13:00")),false);
});
test("projection de statut : un vol de demain avec ETD supérieur reste PRÉVU",()=>{
  assert.equal(flightOperationalStatus({std:"20:00",etd:"20:40",date:"2999-01-01"}),"PRÉVU");
  assert.equal(flightOperationalStatus({std:"20:00",atd:"20:30",date:"2999-01-01"}),"PARTI");
});
