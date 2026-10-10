import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
test("bilan : chaque puce ouvre la liste des vols par résultat", () => {
  const s=fs.readFileSync(new URL("./admin-ux-wrapper.js",import.meta.url),"utf8");
  assert.match(s,/adx-hsrc/);assert.match(s,/function openSourceList\(key\)/);
  for(const t of ["ERREUR","REFUSÉS / EN PAUSE","SANS DONNÉE","NON LUS","LUS"])assert.ok(s.includes("t:'"+t+"'"));
  assert.match(s,/closest\('\.adx-hsrc'\)/);
});

test("bilan : FlightAware arrêté, plus aucun vol (les JU n'y figurent plus) ; un « en pause » ancien sans pause en cours n'est plus un refus", () => {
  const s=fs.readFileSync(new URL("./admin-ux-wrapper.js",import.meta.url),"utf8");
  assert.match(s,/const SRC_ONLY=\{FLIGHTAWARE:\[\]\}/);assert.ok(!/FLIGHTAWARE:\['JU'\]/.test(s));
  assert.match(s,/function latestEff\(x,key\)/);
  assert.match(s,/a\.st==='COOLDOWN'&&!pauseActive\(key\)/);
  assert.ok(s.split("latestEff(").length>=4);        // pastilles, puces du bilan, liste détaillée
});

test("bilan : une tentative refusée vieille de plus de 45 min n'est plus comptée « refusée / en pause »", () => {
  const s=fs.readFileSync(new URL("./admin-ux-wrapper.js",import.meta.url),"utf8");
  const fn=/function staleBlock\(a\)\{[^\n]*\}/.exec(s)[0];
  const staleBlock=new Function(fn+";return staleBlock")();
  assert.equal(staleBlock({at:new Date(Date.now()-60*60000).toISOString()}),true);
  assert.equal(staleBlock({at:new Date(Date.now()-10*60000).toISOString()}),false);
  assert.equal(staleBlock(null),false);
  assert.match(s,/old:\{t:'ANCIENNES TENTATIVES/);
  assert.match(s,/k==='block'&&staleBlock\(a\)\)k='old'/);        // liste détaillée
  assert.match(s,/k==='block'&&staleBlock\(a\)\)\{old\+\+\}/);   // puces du bilan
  assert.match(s,/sec\('old',false\)/);
});
