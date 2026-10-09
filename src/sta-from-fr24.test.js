import test from "node:test";import assert from "node:assert/strict";
import {fillStaFromFr24,fr24Semantic} from "./ops-public-live-flow-optimized.js";
test("STA vide : renseignée depuis FR24, jamais modifiée ensuite ni sur saisie manuelle",()=>{
  const x={};assert.equal(fillStaFromFr24(x,"13:35","t"),true);
  assert.equal(x.sta,"13:35");assert.equal(x.staSource,"PUBLIC_LIVE:FR24");assert.equal(x.flightInfoLog[0].field,"sta");
  assert.equal(fillStaFromFr24(x,"14:00","t"),false);assert.equal(x.sta,"13:35");
  assert.equal(fillStaFromFr24({staSource:"MANUAL"},"14:00","t"),false);
  assert.equal(fillStaFromFr24({},"","t"),false);assert.equal(fillStaFromFr24({},"25h","t"),false);
});
test("l'heure d'arrivée prévue FR24 est lue à l'heure locale de la destination",()=>{
  const r=fr24Semantic({candidates:{semantic:{sta:"2026-10-09T10:35:00.000Z"}}},{origin:"CDG",destination:"IST"});
  assert.equal(r.sta,"13:35");
});
