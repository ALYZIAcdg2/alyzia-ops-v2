import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {atdOverdue,flightAwareAllowed} from "./fa-policy.js";
const rd=f=>fs.readFileSync(new URL(f,import.meta.url),"utf8");
const NOW=Date.parse("2026-10-08T13:00:00Z");     // 15:00 à Paris
test("FlightAware : seulement un vol sans ATD que le FIDS a eu le temps de donner", () => {
  assert.equal(atdOverdue({atd:"10:30",takeoff:"10:49",ata:"13:00"},NOW),false);             // ATD connue : jamais
  assert.equal(atdOverdue({takeoff:"14:50",std:"14:00"},NOW),false);                           // parti depuis 10 min : le FIDS a encore le temps
  assert.equal(atdOverdue({takeoff:"14:40",std:"14:00"},NOW),true);                            // parti depuis 20 min
  assert.equal(atdOverdue({landing:"14:30",std:"11:00"},NOW),true);                            // arrivé
  assert.equal(atdOverdue({ata:"14:30",std:"11:00"},NOW),true);
  assert.equal(atdOverdue({std:"14:00"},NOW),false);                                           // STD passée de 60 min, pas d'infos de départ : trop tôt
  assert.equal(atdOverdue({std:"13:20"},NOW),true);                                            // STD passée de plus de 90 min
  assert.equal(atdOverdue({std:"16:00"},NOW),false);                                           // pas encore l'heure
  assert.equal(atdOverdue({std:"10:00"},NOW,"2026-10-07"),true);                               // vol de la veille sans ATD
  assert.equal(flightAwareAllowed("IZ742",{landing:"22:17"},NOW),true);                        // plus de liste de compagnies
});
test("FlightAware : ATD uniquement, jamais ETD / STA / porte, dans toutes les lectures actives", () => {
  assert.match(rd("./etd-public-flow.js"),/r===flightAware\)continue/);
  assert.match(rd("./sta-public-fallbacks.js"),/read===flightAware\)continue/);
  assert.match(rd("./ground-public-flow.js"),/source==="FLIGHTAWARE"\)continue/);
  assert.match(rd("./flightaware-exact-history.js"),/flightAwareAllowed\(designator\(row,x\),x,Date\.now\(\),row\.flight_date\)/);
  assert.match(rd("./flightaware-exact-history.js"),/for\(const field of \["atd"\]\)/);
  assert.match(rd("./ops-public-live-flow-optimized.js"),/map\.FLIGHTAWAREEXACT=\{atd:/);
  assert.match(rd("./ops-public-live-flow-optimized.js"),/faLeft>0/);                          // 3 vols au plus par passage
});
