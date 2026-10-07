import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {FICHE_CONFIG_UI} from "./fiche-config-actions.js";
const wrapper=readFileSync(new URL("./v2-ui-consistency-wrapper.js",import.meta.url),"utf8");
const etd=readFileSync(new URL("./v2-etd-public-wrapper.js",import.meta.url),"utf8");
test("fiche vol allégée : carte TYPE A/C, boutons SEATMAP / SEAT INOP et pastilles de changement retirés de l'en-tête",()=>{
  assert.equal(wrapper.includes("+acCardHtml(x)+"),false);
  assert.equal(wrapper.includes('onclick="openSeatmap()">▦ SEATMAP</button><button class="v2x-act warn"'),false);
  assert.equal(wrapper.includes('v2x-chip v2x-chip-change" title="Changement'),false);
});
test("statut éditable : badge-bouton, choix AUTO / EMBARQUEMENT / EMBARQUEMENT CLOS, appel /api/admin/boarding",()=>{
  assert.match(wrapper,/class="ops-status-badge v2x-status-edit/);
  assert.match(wrapper,/function v2xEditStatus/);assert.match(wrapper,/function v2xSetStatus/);
  assert.match(wrapper,/\/api\/admin\/boarding\?flight=/);
  for(const p of ["CLEAR","EMBARQUEMENT CLOS"])assert.ok(wrapper.includes("'"+p+"'"));
});
test("INFOS VOL : validation seatmap en vert et changements A/C, GATE, IMMAT, CONFIG dans les intitulés",()=>{
  assert.match(wrapper,/function v2xDecorateInfo/);assert.match(wrapper,/saria-cabin-mini/);
  for(const l of ["GATE","IMMATRICULATION","CONFIGURATION","TYPE APPAREIL"])assert.ok(wrapper.includes("'"+l+"'"));
});
test("boutons SEATMAP / SEAT INOP dans le KPI CONFIGURATION : script valide ; les boutons d'embarquement manuels ne sont plus injectés",()=>{
  const js=/<script[^>]*>([\s\S]*)<\/script>/.exec(FICHE_CONFIG_UI)[1];assert.doesNotThrow(()=>new Function(js));
  assert.match(js,/openSeatmap\(\)/);assert.match(js,/openInopSeat\(\)/);assert.match(js,/\.config-cap-kpi/);
  assert.equal(etd.includes("BOARDING_UI"),false);assert.match(etd,/FICHE_CONFIG_UI/);
});
