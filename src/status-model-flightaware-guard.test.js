import test from "node:test";
import assert from "node:assert/strict";
import {derive} from "./status-model-test.js";

// Cas réels du 3 octobre 2026 (V2 affichait ARRIVÉ pour des vols en l'air : la page FlightAware cite « Arrived » dans l'historique des vols précédents)
const date="2026-10-03";
const mk=(o)=>({origin:"CDG",statusModelEvidence:{flightAwarePhase:"ARRIVED",flightAwarePhases:["ARRIVED","AIRBORNE"]},...o});
const at=(h,m)=>Date.UTC(2026,9,3,h,m);   // heure UTC

test("AV55 CDG->BOG : ARRIVED vu dans la page mais arrivée attendue à 12:35 locale Bogota -> PARTI",()=>{
  const x=mk({destination:"BOG",std:"08:55",atd:"08:52",eta:"12:35"});
  assert.equal(derive(x,date,at(13,13)).status,"PARTI");
});
test("HF177 CDG->ABJ : arrivée 13:44 locale (= 13:44 UTC) pas atteinte à 13:12 UTC -> PARTI",()=>{
  const x=mk({destination:"ABJ",std:"09:00",atd:"09:32",eta:"13:44"});
  assert.equal(derive(x,date,at(13,12)).status,"PARTI");
});
test("SQ335 CDG->SIN : ETA 05:51 le lendemain -> PARTI",()=>{
  const x=mk({destination:"SIN",std:"10:55",atd:"10:57",eta:"05:51"});
  assert.equal(derive(x,date,at(13,12)).status,"PARTI");
});
test("ETA dépassée sans ATA : le vol reste PARTI (plus d'ARRIVÉ par ETA + 15 min) ; il faut une ATA",()=>{
  const x=mk({destination:"ABJ",std:"09:00",atd:"09:32",eta:"13:44"});
  assert.equal(derive(x,date,at(13,58)).status,"PARTI");
  assert.equal(derive(x,date,at(13,59)).status,"PARTI");
  assert.equal(derive(x,date,at(16,0)).status,"PARTI");
});
test("un ATA réel donne ARRIVÉ quel que soit l'horaire",()=>{
  const x=mk({destination:"ABJ",std:"09:00",atd:"09:32",eta:"13:44",ata:"13:40"});
  assert.equal(derive(x,date,at(13,12)).status,"ARRIVÉ");
});
