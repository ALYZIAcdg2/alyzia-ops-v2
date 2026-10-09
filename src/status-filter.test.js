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
test("statuts en liste défilante à côté de la recherche, qui garde sa largeur ; tous les statuts restent affichés",()=>{
  assert.match(STATUS_FILTER_UI,/\.alz-search-row\{display:flex;flex-wrap:nowrap/);            // même ligne
  assert.match(STATUS_FILTER_UI,/flex:0 0 clamp\(190px,50%,360px\)!important/);               // recherche : au moins 190 px
  assert.match(STATUS_FILTER_UI,/overflow-x:auto/);                                           // liste défilante
  assert.ok(!/flex-direction:column/.test(STATUS_FILTER_UI));
  assert.ok(!/alz-sf-none/.test(STATUS_FILTER_UI));                                           // plus de statut qui disparaît
  assert.match(STATUS_FILTER_UI,/\.alz-sf-chip\.zero:not\(\.active\)\{opacity:\.5\}/);        // grisé quand il n'y a aucun vol
  assert.match(js,/function visibleWithoutUs/);                                               // nombres selon terminal / recherche / horaires
  assert.match(js,/\.home-flight-search'\)\)later\(\)/);assert.match(js,/terminal-filter-bar/);
});
test("sélection simple : un statut à la fois, re-toucher ou « TOUS » remet tout",()=>{
  assert.match(js,/selected=\(k==='\*'\|\|selected===k\)\?'':k/);
  assert.match(js,/role','tablist'/);
  assert.match(js,/dispatchEvent\(new Event\('resize'\)\)/);                                 // la croix de la recherche se repositionne
});
