import test from "node:test";
import assert from "node:assert/strict";
import {buildPauses} from "./pauses.js";
const now=Date.parse("2026-10-08T10:00:00Z");
test("pauses : seules les pauses en cours, avec leur fin", () => {
  const st={fs:{page:{until:now+20*60000},api:{until:now+5*60000}},fa:{until:now-1000},board:{pausedUntil:now+7*60000}};
  const p=buildPauses(st,[],now);
  assert.deepEqual(p.map(x=>x.key).sort(),["FLIGHTSTATS","FR24BOARD"]);
  assert.equal(p.find(x=>x.key==="FLIGHTSTATS").minutes,20);          // la plus longue des deux
  assert.equal(p.find(x=>x.key==="FR24BOARD").minutes,7);
});
test("pauses FlightAware : général ou 45 min après le dernier 429 d'une page", () => {
  const p=buildPauses({fa:{until:0}},[{httpStatus:429,checkedAt:new Date(now-10*60000).toISOString()},{httpStatus:429,checkedAt:new Date(now-40*60000).toISOString()}],now);
  assert.equal(p.length,1);assert.equal(p[0].key,"FLIGHTAWARE");assert.equal(p[0].minutes,35);   // 45 min après le 429 le plus récent
  assert.equal(buildPauses(null,[],now).length,0);
});

test("pauses FlightStats : attente de 20 min par vol refusé, plage des reprises", () => {
  const refused=[now-15*60000,now-5*60000,now-30*60000];     // reprises à now+5, now+15 ; le troisième est déjà repris
  const p=buildPauses({},[],now,refused).find(x=>x.key==="FLIGHTSTATS");
  assert.equal(p.waiting,2);assert.equal(p.general,false);
  assert.equal(p.minutes,15);                                   // la dernière reprise
  assert.equal(Date.parse(p.until)-Date.parse(p.from),10*60000);// plage 5 → 15 min
  assert.equal(buildPauses({},[],now,[now-25*60000]).length,0);
});
