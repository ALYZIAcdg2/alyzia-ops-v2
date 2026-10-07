import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("la ligne d'historique FR24 ne fournit plus l'immatriculation du vol",()=>{
  const src=readFileSync(new URL("./fr24-public-html.js",import.meta.url),"utf8");
  assert.equal(/reg:semantic\.reg\|\|row\.reg/.test(src),false);
  assert.equal(/reg:semantic\.reg\|\|null/.test(src),true);
});
