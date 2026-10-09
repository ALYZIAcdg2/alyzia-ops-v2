import test from "node:test";import assert from "node:assert/strict";
import {untilDeadline,LIVE_RUN_BUDGET_MS} from "./ops-public-live-flow-optimized.js";
test("avant l'échéance le vol est lu ; après, il est reporté sans être démarré",async()=>{
  let now=1000,ran=[];const f=untilDeadline(2000,async r=>{ran.push(r);return {status:"UPDATED"}},()=>now);
  assert.deepEqual(await f("A"),{status:"UPDATED"});
  now=2500;assert.deepEqual(await f("B"),{status:"DEFERRED"});
  assert.deepEqual(ran,["A"]);
});
test("un vol déjà commencé va jusqu'au bout même si l'échéance tombe pendant sa lecture",async()=>{
  let now=1000;const f=untilDeadline(2000,async()=>{now=3000;return {status:"UPDATED"}},()=>now);
  assert.deepEqual(await f("A"),{status:"UPDATED"});
});
test("le budget d'un passage laisse de la place aux autres étapes (moins du plafond de 70 s)",()=>{assert.ok(LIVE_RUN_BUDGET_MS<=45000)});
