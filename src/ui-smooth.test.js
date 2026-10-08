import test from "node:test";
import assert from "node:assert/strict";
import {UI_SMOOTH_UI} from "./ui-smooth.js";
import {CLASS_ROWS_UI} from "./class-rows.js";
import {TAB_MEMORY_UI} from "./tab-memory.js";
const js=h=>/<script[^>]*>([\s\S]*)<\/script>/.exec(h)[1];
test("scripts de fluidité valides", () => {
  assert.doesNotThrow(()=>new Function(js(UI_SMOOTH_UI)));
  assert.doesNotThrow(()=>new Function(js(TAB_MEMORY_UI)));
  assert.match(UI_SMOOTH_UI,/CHARGEMENT DES VOLS/);
  assert.match(js(UI_SMOOTH_UI),/renderCurrentViewPreserved/);      // rendu différé pendant le défilement
  assert.match(TAB_MEMORY_UI,/alz-tabwait/);                         // pas de liste visible avant l'onglet restauré
});
test("classes en ligne dans les tuiles WEB / SBY / DISPO", () => {
  assert.match(CLASS_ROWS_UI,/\.wsa-mini-classes\{display:grid/);
  assert.match(CLASS_ROWS_UI,/@container/);
});
