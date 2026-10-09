import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
const src=fs.readFileSync(new URL("./ops-public-live-flow-optimized.js",import.meta.url),"utf8");
import {derive} from "./status-model-test.js";
test("la lecture d'un vol ne remet plus EN VOL un vol que le modèle conclut ARRIVÉ (ETA + 15 min)",()=>{
  assert.match(src,/deriveModelStatus\(\{\.\.\.current\},f\.date,Date\.now\(\)\)/);
  assert.match(src,/dm\.reason===\"ETA_PASSED_15\"\)nextStatus=\"ARRIVÉ\"/);
  // placé après la garde « en vol » (guardAirborneStatus), avant l'écriture du statut
  const iGuard=src.indexOf("guardAirborneStatus(nextStatus,current)"),iModel=src.indexOf("deriveModelStatus({...current}"),iWrite=src.indexOf("current.status=nextStatus;");
  assert.ok(iGuard<iModel&&iModel<iWrite);
});
test("le modèle donne bien ARRIVÉ / ETA_PASSED_15 pour le cas d'AH1083 (décollé, ETA 22:26 ORN dépassée de plus de 15 min, sans LDG ni ATA)",()=>{
  const x={std:"21:20",atd:"21:16",takeoff:"21:30",eta:"22:26",origin:"CDG",destination:"ORN",flight_date:"2026-10-09"};
  const d=derive(x,"2026-10-09",Date.parse("2026-10-09T22:30:00Z"));   // 00:30 Paris, ORN = UTC+1 : 23:30 locale
  assert.equal(d.status,"ARRIVÉ");assert.equal(d.reason,"ETA_PASSED_15");
});
