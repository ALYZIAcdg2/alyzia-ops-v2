import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {STATUS_FILTER_UI} from "./status-filter-ui.js";
const js=/<script[^>]*>([\s\S]*)<\/script>/.exec(STATUS_FILTER_UI)[1];
test("filtre par statut : script valide, injecté dans la page",()=>{
  assert.doesNotThrow(()=>new Function(js));
  const w=fs.readFileSync(new URL("./v2-etd-public-wrapper.js",import.meta.url),"utf8");
  assert.match(w,/STATUS_FILTER_UI/);
  assert.match(js,/alyzia-status-hidden/);
});
test("les statuts affichés sur les cartes sont rangés dans les bons filtres",()=>{
  const grab=n=>new RegExp("function "+n+"\\([^)]*\\)\\{[^\\n]*\\}").exec(js)[0];
  const keyOf=new Function(grab("norm")+grab("keyOf")+";return keyOf")();
  const cases={"À L’HEURE":"HEURE","À L'HEURE":"HEURE","PRÉVU":"HEURE","PROGRAMMÉ":"HEURE","EMBARQUEMENT":"EMBARQ","EMBARQUEMENT CLOS":"EMBARQ","RETARDÉ":"RETARD","PARTI":"PARTI","EN VOL":"ENVOL","ATTERRI":"ATTERRI","ATTERI":"ATTERRI","ARRIVÉE":"ARRIVE","ARRIVÉ":"ARRIVE","ANNULÉ":"ANNULE"};
  for(const [t,k] of Object.entries(cases))assert.equal(keyOf(t),k,t);
});
test("même construction que HORAIRES : rangée de contrôles, menu, bascule à l'appui, ordre demandé",()=>{
  assert.match(js,/function controlsHost\(\)/);assert.match(js,/alyzia-time-filter-wrap/);                 // même rangée, juste après HORAIRES
  assert.match(STATUS_FILTER_UI,/\.alyzia-status-filter-menu\{position:absolute;left:0;top:52px;z-index:200/); // menu comme celui des horaires (au-dessus des cartes)
  assert.ok(!/transform/.test(STATUS_FILTER_UI.replace(/<script[\s\S]*$/,"")));                              // aucun contexte d'empilement : le menu ne passe pas derrière les cartes
  assert.match(js,/addEventListener\('pointerdown'/);assert.match(js,/Date\.now\(\)-lastToggle>700/);       // bascule à l'appui, click suivant ignoré
  const order=[...js.matchAll(/\['(\w+)','([^']+)'\]/g)].map(m=>m[2]);
  assert.deepEqual(order.slice(0,7),["PARTI","À L’HEURE","RETARDÉ","EN VOL","EMBARQUEMENT + CLOS","ATTERRI","ARRIVÉE"]);
  assert.match(js,/<span>TOUS<\/span>/);assert.ok(!/STATUT/.test(js));                                      // « TOUS » en premier, plus de libellé STATUT
  assert.match(STATUS_FILTER_UI,/html body #app \.flight-home-row\.ops-flight-card\.alyzia-status-hidden\.alyzia-status-hidden\{display:none!important\}/);
});
test("sélection simple, par défaut TOUS, un statut vidé par les filtres est désélectionné",()=>{
  assert.match(js,/selected=\(k==='\*'\|\|selected===k\)\?'':k/);
  assert.ok(!/sessionStorage/.test(js));
  assert.ok(!/selected=''\s*;?\s*\n?\s*Array/.test(js));
  assert.match(js,/e\.key==='Escape'/);
  assert.match(js,/alyzia-home-clear'\)\)selected=''/);
});
test("chaque statut du menu porte la couleur de son badge sur les cartes",()=>{
  for(const [k,bg] of [["HEURE","#e1f5e9"],["RETARD","#fff0d0"],["ENVOL","#dcecff"],["ARRIVE","#d7efec"],["ANNULE","#ffe1e5"],["PARTI","#e6f8f3"]])assert.match(STATUS_FILTER_UI,new RegExp('data-k="'+k+'"\\]>span[^{]*\\{background:'+bg));
});
test("recalcul espacé et passage léger sans mesure de mise en page",()=>{
  assert.match(js,/setTimeout\(sync,300\)/);
  assert.ok(!/getComputedStyle/.test(js.slice(js.indexOf('function quick'),js.indexOf('function hook'))));
});

test("masquage en double (classe + style en ligne prioritaire) et bouton sur sa propre ligne sur téléphone",()=>{
  assert.match(js,/r\.style\.setProperty\('display','none','important'\)/);
  assert.match(js,/window\.innerWidth<=900/);assert.match(js,/alyzia-status-row/);
  assert.match(js,/window\.__alyziaStatusDebug/);
});
