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
test("un seul bouton STATUT à côté de la recherche, qui ouvre la liste de tous les statuts",()=>{
  assert.match(STATUS_FILTER_UI,/\.alz-search-row\{display:flex;flex-wrap:nowrap/);            // même ligne
  assert.match(STATUS_FILTER_UI,/\.alz-search-row \.home-flight-search\{flex:1 1 auto!important/);  // la recherche garde sa largeur
  assert.match(js,/class="alz-status-btn"/);assert.match(js,/aria-haspopup="listbox"/);assert.match(js,/className='alz-status-band'/);assert.match(STATUS_FILTER_UI,/\.alz-status-band\{position:absolute[^}]*overflow-y:auto/);   // liste déroulante
  assert.match(js,/sessionStorage\.setItem\(OPEN/);   // reste ouvert après un rafraîchissement de la page
  assert.match(js,/TOUS LES STATUTS/);
  for(const l of ["HEURE","EMBARQUEMENT","RETARDÉ","PARTI","EN VOL","ATTERRI","ARRIVÉ","ANNULÉ"])assert.ok(js.includes(l),l);
  assert.match(STATUS_FILTER_UI,/\.alz-sf-item\.zero:not\(\.active\)\{display:none\}/);       // seuls les statuts présents sont listés
  assert.match(js,/total>0&&!c\[selected\]/);                                                 // un statut vidé par les filtres est désélectionné
  assert.match(js,/function visibleWithoutUs/);                                               // nombres selon terminal / recherche / horaires
  assert.match(js,/\.home-flight-search'\)\)later\(\)/);assert.match(js,/terminal-filter-bar/);
});
test("sélection simple : un statut à la fois, re-toucher ou « TOUS LES STATUTS » remet tout ; la liste se ferme",()=>{
  assert.match(js,/selected=\(k==='\*'\|\|selected===k\)\?'':k/);
  assert.match(js,/setOpen\(false\)/);assert.match(js,/e\.key==='Escape'/);                   // se ferme au choix, au clic dehors, à Échap
  assert.match(js,/dispatchEvent\(new Event\('resize'\)\)/);                                 // la croix de la recherche se repositionne
});
test("après un redessin de la liste, le bouton et le filtre sont remis dans le même cycle ; le bouton colle à la recherche",()=>{
  assert.match(js,/function quick\(\)/);assert.match(js,/function own\(/);assert.ok(!/getComputedStyle/.test(js.slice(js.indexOf('function quick'),js.indexOf('function own'))));assert.match(js,/setTimeout\(sync,300\)/);
  assert.match(STATUS_FILTER_UI,/\.alz-search-row\{[^}]*justify-content:flex-start/);
});
