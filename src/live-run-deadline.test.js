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

import {makeReadOne} from "./ops-public-live-flow-optimized.js";
test("une lecture de vol qui ne répond pas est coupée (TIMEOUT) et ne bloque pas les autres ; une erreur n'arrête pas le passage ; les durées sont notées",async()=>{
  const timings=[];
  const read=makeReadOne(async r=>{if(r.flight_number==="1")return new Promise(()=>{});if(r.flight_number==="2")throw new Error("boom");return {status:"UPDATED"}},timings,40);
  const out=await Promise.all([read({airline:"AH",flight_number:"1"}),read({airline:"AH",flight_number:"2"}),read({airline:"AH",flight_number:"3"})]);
  assert.deepEqual(out.map(o=>o.status),["TIMEOUT","ERROR","UPDATED"]);
  assert.equal(timings.length,3);assert.ok(timings.find(t=>t.flight==="AH1").ms>=30);
});

test("un vol en TIMEOUT / ERREUR est marqué lu (passe au bout de la file) ; un vol lu normalement n'est pas touché ; le nom du vol n'est pas déformé",async()=>{
  const marked=[],timings=[];
  const read=makeReadOne(async r=>{if(r.flight_number==="LO332")return new Promise(()=>{});return {status:"UPDATED"}},timings,30,async(r,st)=>{marked.push([r.flight_number,st])});
  await read({airline:"LO",flight_number:"LO332",identity:"i1"});await read({airline:"AH",flight_number:"1083",identity:"i2"});
  assert.deepEqual(marked,[["LO332","TIMEOUT"]]);
  assert.deepEqual(timings.map(t=>t.flight),["LO332","AH1083"]);
});
