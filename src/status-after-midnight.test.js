import test from "node:test";
import assert from "node:assert/strict";
import {derive} from "./status-model-test.js";
const date="2026-10-08";
const tu={std:"19:45",sta:"21:45",origin:"CDG",destination:"DJE",dest:"DJE",etd:"02:58"};
test("vol du 08/10 décollé le 09/10 à 02:58 : EN VOL, pas ARRIVÉ (TU2655)",()=>{
  const now=Date.UTC(2026,9,9,1,20);                               // 03:20 Paris le 09/10
  assert.equal(derive({...tu,takeoff:"02:58"},date,now).status,"EN VOL");
  assert.equal(derive({...tu,takeoff:"02:58",atd:"02:55"},date,now).status,"EN VOL");
  assert.equal(derive({...tu,takeoff:"02:58",landing:"05:30"},date,now).status,"ATTERRI");
  assert.equal(derive({...tu,takeoff:"02:58",ata:"05:40"},date,now).status,"ARRIVÉ");
});
test("vol sans passage de minuit : inchangé, ARRIVÉ 15 min après l'heure d'arrivée",()=>{
  const x={std:"14:00",sta:"20:00",origin:"CDG",destination:"AMM",dest:"AMM",takeoff:"14:15"};
  assert.equal(derive(x,"2026-10-07",Date.UTC(2026,9,7,13,0)).status,"EN VOL");
  assert.equal(derive(x,"2026-10-07",Date.UTC(2026,9,7,17,30)).status,"ARRIVÉ");
});
