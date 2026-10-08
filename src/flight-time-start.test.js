import test from "node:test";
import assert from "node:assert/strict";
import {REFERENCE_LIST_RENDERER} from "./flight-list-reference-ui.js";
import fs from "node:fs";
test("temps écoulé / restant : démarre au décollage (TO), pas à l'ATD ; ATTERRI compte depuis LDG", () => {
  assert.doesNotThrow(()=>new Function(REFERENCE_LIST_RENDERER));
  assert.match(REFERENCE_LIST_RENDERER,/const actual=t\.takeoff;if\(!actual\)return null;/);          // départ = décollage seulement
  assert.match(REFERENCE_LIST_RENDERER,/\/\^EN VOL\$\/\.test\(up\(st\.main\)\)&&t\.takeoff&&!t\.landing&&!t\.ata/);   // compteurs : EN VOL avec TO, avant LDG
  assert.match(REFERENCE_LIST_RENDERER,/atterri depuis /);
  assert.ok(!/const actual=t\.takeoff\|\|t\.atd/.test(REFERENCE_LIST_RENDERER));
  const w=fs.readFileSync(new URL("./v2-ui-consistency-wrapper.js",import.meta.url),"utf8");
  assert.match(w,/if\(main!=='EN VOL'\|\|!t\.takeoff\|\|t\.landing\|\|t\.ata\)remain=''/);       // fiche : « arrivée dans » seulement entre TO et LDG
});
