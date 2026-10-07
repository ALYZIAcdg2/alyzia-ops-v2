import test from "node:test";
import assert from "node:assert/strict";
import {derive} from "./status-model-test.js";
const date="2026-10-07",now=Date.UTC(2026,9,7,13,0);
const mk=o=>({std:"14:00",sta:"20:00",destination:"AMM",dest:"AMM",origin:"CDG",...o});
test("étapes : ATD seul = PARTI, TO = EN VOL, LDG = ATTERRI, ATA = ARRIVÉ",()=>{
  assert.equal(derive(mk({atd:"14:05"}),date,now).status,"PARTI");
  assert.equal(derive(mk({atd:"14:05",takeoff:"14:15"}),date,now).status,"EN VOL");
  assert.equal(derive(mk({atd:"14:05",takeoff:"14:15",landing:"19:00"}),date,now).status,"ATTERRI");
  assert.equal(derive(mk({atd:"14:05",takeoff:"14:15",landing:"19:00",ata:"19:05"}),date,now).status,"ARRIVÉ");
});
