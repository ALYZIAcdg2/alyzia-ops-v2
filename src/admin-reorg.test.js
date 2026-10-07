import test from "node:test";
import assert from "node:assert/strict";
import {ADMIN_REORG_UI} from "./admin-reorg.js";
test("réorganisation admin : script valide, menu OUTILS et pastilles compactes",()=>{
  const js=/<script[^>]*>([\s\S]*)<\/script>/.exec(ADMIN_REORG_UI)[1];
  assert.doesNotThrow(()=>new Function(js));
  assert.match(js,/OUTILS/);assert.match(js,/adx-srcbtn/);assert.match(js,/adminRegRestoreBtn/);assert.match(js,/adn-v4-btn\.reset/);
  assert.match(ADMIN_REORG_UI,/\.adx-health:not\(\.adx-health-copy\)/);   // la copie de la page SOURCES PUBLIQUES garde son détail complet
});

test("boutons du menu OUTILS : style uniforme imposé en ligne, bouton OUTILS au gabarit d'ACTUALISER",()=>{
  assert.match(ADMIN_REORG_UI,/setProperty\(k,UNIFORM\[k\],'important'\)/);
  assert.match(ADMIN_REORG_UI,/getComputedStyle\(ref\)/);
  assert.doesNotMatch(ADMIN_REORG_UI,/font:900 14px\/1\.2 inherit/);   // raccourci invalide ignoré par le navigateur
});
