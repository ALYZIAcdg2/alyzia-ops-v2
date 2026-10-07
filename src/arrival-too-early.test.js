import test from "node:test";
import assert from "node:assert/strict";
import {arrivedTooEarly} from "./local-time-guard.js";
import {fixArrivalClocks} from "./ops-arrival-sanitizer.js";
const iz={date:"2026-10-07",std:"16:00",sta:"21:45",takeoff:"16:48",originZone:"Europe/Paris",destZone:"Asia/Jerusalem"};
test("IZ742 CDG-TLV : atterrissage 18:30 et ATA 18:40 impossibles 42-52 min après le décollage",()=>{
  assert.equal(arrivedTooEarly("18:30",iz),true);
  assert.equal(arrivedTooEarly("18:40",iz),true);
});
test("arrivées plausibles conservées (à l'heure, en avance raisonnable, vol court)",()=>{
  assert.equal(arrivedTooEarly("21:30",iz),false);          // ETA réelle
  assert.equal(arrivedTooEarly("21:10",iz),false);          // 35 min d'avance
  assert.equal(arrivedTooEarly("19:00",{date:"2026-10-07",std:"10:00",sta:"11:20",takeoff:"10:10",originZone:"Europe/Paris",destZone:"Europe/Paris"}),false); // vol de 1h20 < 90 min : jamais rejeté
});
test("le sanitizer retire landing et ata trop tôt sans les transformer en ETA",()=>{
  const x={std:"16:00",sta:"21:45",origin:"CDG",destination:"TLV",takeoff:"16:48",landing:"18:30",ata:"18:40",eta:"21:30"};
  const out=fixArrivalClocks(x,"2026-10-07",Date.UTC(2026,9,7,16,30));
  assert.deepEqual(out.filter(c=>c.tooEarly!==undefined).map(c=>c.field).sort(),["ata","landing"]);
});

test("vol long-courrier de plus de 12 h : arrivée réelle conservée (SQ335 CDG-SIN, ATA 05:50), arrivée impossible refusée",()=>{
  const sq={date:"2026-10-07",std:"10:55",sta:"06:05",takeoff:"11:23",originZone:"Europe/Paris",destZone:"Asia/Singapore"};
  assert.equal(arrivedTooEarly("05:50",sq),false);
  assert.equal(arrivedTooEarly("05:40",sq),false);
  assert.equal(arrivedTooEarly("17:00",sq),true);   // 5 h après le décollage pour un vol de 13 h
});
