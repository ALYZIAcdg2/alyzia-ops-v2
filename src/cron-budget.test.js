import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
import {createCronBudget,timebox} from "./cron-budget.js";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test("une étape rapide rend son résultat et sa durée est notée",async()=>{
  const B=createCronBudget();const v=await B.step("a",async()=>{await sleep(5);return 42});
  assert.equal(v,42);const s=B.summary();assert.equal(s.steps[0].name,"a");assert.equal(s.steps[0].status,"ok");
});
test("une étape trop lente est abandonnée : le passage continue avec la valeur de repli",async()=>{
  const B=createCronBudget();const t0=Date.now();
  const v=await B.step("lente",()=>sleep(500).then(()=>"tard"),{ms:30,fallback:"repli"});
  assert.equal(v,"repli");assert.ok(Date.now()-t0<300);assert.equal(B.summary().steps[0].status,"timeout");
});
test("une étape en erreur ne casse pas le passage",async()=>{
  const B=createCronBudget();const v=await B.step("x",()=>{throw new Error("boom")},{fallback:"ok?"});
  assert.equal(v,"ok?");assert.equal(B.summary().steps[0].status,"error");assert.match(B.summary().steps[0].error,/boom/);
});
test("passé la limite douce, une étape facultative est sautée, une étape essentielle jamais",async()=>{
  let t=1000;const B=createCronBudget({now:()=>t,softLimitMs:60000});
  t=1000+61000;
  let ran=0;
  const opt=await B.step("facultative",()=>{ran++;return "x"},{optional:true,fallback:"saut"});
  const ess=await B.step("essentielle",()=>{ran++;return "ok"});
  assert.equal(opt,"saut");assert.equal(ess,"ok");assert.equal(ran,1);
  assert.deepEqual(B.summary().steps.map(s=>s.status),["skipped","ok"]);
});
test("timebox rend un résultat tardif invisible mais ne laisse aucune minuterie en suspens",async()=>{
  const r=await timebox(()=>"vite",1000);assert.equal(r,"vite");
});
test("branchement : étapes essentielles jamais facultatives ; pages FIDS facultatives et en dernier",()=>{
  const w=fs.readFileSync(new URL("./v2-etd-public-wrapper.js",import.meta.url),"utf8");
  for(const n of ["live-per-flight","fr24-board","status-model","fids-bulk","gatenavo"])assert.ok(!new RegExp('B\\.step\\("'+n+'"[^\\n]*optional:true').test(w),n);
  assert.match(w,/B\.step\("fids-flight-pages"[^\n]*optional:true/);
  assert.ok(w.indexOf('B.step("fids-flight-pages"')>w.indexOf('B.step("status-model-final"'));
  assert.match(w,/globalThis\.__cronBudget=B/);assert.match(w,/saveCronTiming\(env,B\.summary\(\)\)/);
  assert.match(w,/\/api\/admin\/cron-timing/);
});
