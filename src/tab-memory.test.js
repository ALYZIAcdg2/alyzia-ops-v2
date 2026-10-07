import test from "node:test";
import assert from "node:assert/strict";
import {TAB_MEMORY_UI} from "./tab-memory.js";
test("mémoire d'onglet : script valide, clics de navigation seulement, une restauration, par onglet de navigateur",()=>{
  const js=/<script[^>]*>([\s\S]*)<\/script>/.exec(TAB_MEMORY_UI)[1];
  assert.doesNotThrow(()=>new Function(js));
  assert.match(js,/sessionStorage/);                      // nouvel onglet / nouvelle session = VOLS
  assert.match(js,/header \.nav button,\.mobile-bottom-nav button/);   // seuls les boutons de navigation mémorisent
  for(const fn of ["openFlightSearch","renderPrepa","renderTools","renderAdminDashboard"])assert.ok(js.includes(fn));
  assert.match(js,/done=true/);                           // restauration unique
});
