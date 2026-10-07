import test from "node:test";
import assert from "node:assert/strict";
import {ADMIN_REORG_UI} from "./admin-reorg.js";
test("réorganisation admin : script valide, menu OUTILS et pastilles compactes",()=>{
  const js=/<script[^>]*>([\s\S]*)<\/script>/.exec(ADMIN_REORG_UI)[1];
  assert.doesNotThrow(()=>new Function(js));
  assert.match(js,/OUTILS/);assert.match(js,/adx-srcbtn/);assert.match(js,/adminRegRestoreBtn/);assert.match(js,/adn-v4-btn\.reset/);
  assert.match(ADMIN_REORG_UI,/\.adx-health:not\(\.adx-health-copy\)/);   // la copie de la page SOURCES PUBLIQUES garde son détail complet
});
