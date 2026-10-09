import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {STATUS_FILTER_UI} from "./status-filter-ui.js";
const js=/<script[^>]*>([\s\S]*)<\/script>/.exec(STATUS_FILTER_UI)[1];
test("filtre par statut : script valide, injecté dans la page, branché sous la recherche",()=>{
  assert.doesNotThrow(()=>new Function(js));
  const w=fs.readFileSync(new URL("./v2-etd-public-wrapper.js",import.meta.url),"utf8");
  assert.match(w,/STATUS_FILTER_UI/);
  assert.match(js,/\.home-flight-search/);assert.match(js,/alz-status-hidden/);
});
test("les statuts affichés sur les cartes sont rangés dans les bons filtres",()=>{
  const grab=n=>new RegExp("function "+n+"\\([^)]*\\)\\{[^\\n]*\\}").exec(js)[0];
  const keyOf=new Function(grab("norm")+grab("keyOf")+";return keyOf")();
  const cases={"À L’HEURE":"HEURE","À L'HEURE":"HEURE","PRÉVU":"HEURE","PROGRAMMÉ":"HEURE","EMBARQUEMENT":"EMBARQ","EMBARQUEMENT CLOS":"EMBARQ","RETARDÉ":"RETARD","PARTI":"PARTI","EN VOL":"ENVOL","ATTERRI":"ATTERRI","ATTERI":"ATTERRI","ARRIVÉE":"ARRIVE","ARRIVÉ":"ARRIVE","ANNULÉ":"ANNULE","DÉROUTÉ":"AUTRE","":"AUTRE"};
  for(const [t,k] of Object.entries(cases))assert.equal(keyOf(t),k,t);
});
test("bandeau de statuts : à côté de la recherche, défilant, suit le terminal et la recherche",()=>{
  assert.match(STATUS_FILTER_UI,/\.alz-search-row\{display:flex/);  // même ligne que la recherche
  assert.match(STATUS_FILTER_UI,/overflow-x:auto/);              // bandeau défilant
  assert.match(js,/function visibleWithoutUs/);             // comptage = sélection affichée (terminal, recherche, favoris, horaires)
  assert.match(js,/alz-sf-none/);                           // un statut sans vol disparaît du bandeau
  assert.match(js,/\.home-flight-search'\)\)later\(\)/);    // recalcul à chaque frappe dans la recherche
  assert.match(js,/terminal-filter-bar/);                   // et au changement de terminal
});
test("bandeau de statuts : la recherche est réduite et le bandeau reste sur la même ligne, mobile compris",()=>{
  assert.match(STATUS_FILTER_UI,/flex:0 1 clamp\(130px,34%,360px\)!important/);   // recherche réduite
  assert.match(STATUS_FILTER_UI,/\.alz-search-row\{display:flex;flex-wrap:nowrap/);
  assert.ok(!/flex-direction:column/.test(STATUS_FILTER_UI));                      // plus d'empilement : il écrasait le bandeau (hauteur 0)
});
