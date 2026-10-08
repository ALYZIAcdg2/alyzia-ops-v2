import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
test("bilan : chaque puce ouvre la liste des vols par résultat", () => {
  const s=fs.readFileSync(new URL("./admin-ux-wrapper.js",import.meta.url),"utf8");
  assert.match(s,/adx-hsrc/);assert.match(s,/function openSourceList\(key\)/);
  for(const t of ["ERREUR","REFUSÉS / EN PAUSE","SANS DONNÉE","NON LUS","LUS"])assert.ok(s.includes("t:'"+t+"'"));
  assert.match(s,/closest\('\.adx-hsrc'\)/);
});
