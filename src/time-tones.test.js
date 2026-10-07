import test from "node:test";
import assert from "node:assert/strict";
import {REFERENCE_LIST_RENDERER} from "./flight-list-reference-ui.js";
const src=String(REFERENCE_LIST_RENDERER);
const fn=new Function("clock",src.slice(src.indexOf("function opsClockMin"),src.indexOf("function opsTimeCell"))+";return opsTimeTone;");
const tone=fn(v=>String(v||""));
const t={std:"17:15",sta:"18:45"};
test("départ : avant l'heure / à l'heure / après l'heure",()=>{
  assert.equal(tone("ETD","16:52",t),"ops-early");
  assert.equal(tone("ETD","17:12",t),"ops-ontime");
  assert.equal(tone("ETD","17:15",t),"ops-ontime");
  assert.equal(tone("ETD","17:30",t),"ops-ontime");
  assert.equal(tone("ETD","17:31",t),"ops-estimated");
  assert.equal(tone("ATD","17:31",t),"ops-late");
});
test("arrivée : avant l'heure / à l'heure / après l'heure",()=>{
  assert.equal(tone("ETA","18:30",t),"ops-early");
  assert.equal(tone("ETA","18:50",t),"ops-ontime");
  assert.equal(tone("ETA","19:04",t),"ops-estimated");
  assert.equal(tone("ATA","19:04",t),"ops-late");
});
