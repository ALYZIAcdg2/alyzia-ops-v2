import test from "node:test";
import assert from "node:assert/strict";
import {gatenavoKey} from "./gatenavo-probe.js";
test("numéros de vol : zéros de tête ignorés des deux côtés", () => {
  assert.equal(gatenavoKey("MH021"),gatenavoKey("MH21"));
  assert.equal(gatenavoKey("AF004"),gatenavoKey("AF 4"));
  assert.equal(gatenavoKey("af098"),"AF98");
  assert.equal(gatenavoKey("D83637"),"D83637");     // pas de zéro de tête : inchangé
  assert.equal(gatenavoKey("U24691"),"U24691");
  assert.equal(gatenavoKey("A3453"),"A3453");
  assert.equal(gatenavoKey("TK1822"),"TK1822");
  assert.notEqual(gatenavoKey("AF4"),gatenavoKey("AF40"));   // 4 et 40 restent distincts
});
