import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
const src=f=>fs.readFileSync(new URL(f,import.meta.url),"utf8");
test("tableau ADMIN : colonnes TO et LDG, tri par en-tête, filtre de statut propre, couleurs de statut",()=>{
  const v2=src("./admin-dashboard-v2-wrapper.js");
  assert.match(v2,/\['to','TO',x=>x\.takeoff,'t'\]/);assert.match(v2,/\['ldg','LDG',x=>x\.landing,'t'\]/);
  // ordre : ... ATD, TO, ETA, LDG, ATA
  const order=[...v2.matchAll(/\['(\w+)','[^']+',x=>/g)].map(m=>m[1]).join(",");
  assert.match(order,/etd,atd,to,eta,ldg,ata,gate/);
  assert.match(v2,/th\[data-sort\]/);assert.match(v2,/function sortRows\(rows\)/);
  assert.match(v2,/id="adminStatusSel"/);assert.match(v2,/stKey\(x\.flightStatus\)===adminStatus/);
  assert.match(v2,/adn-sb adn-sb-'\+stKey/);
  for(const k of ["HEURE","RETARD","PARTI","ENVOL","ARRIVE","ANNULE"])assert.ok(v2.includes(".adn-sb-"+k));
  assert.match(v2,/<td>'\+esc\(x\.takeoff\|\|'—'\)\+'<\/td><td>'\+esc\(x\.eta\|\|'—'\)\+'<\/td><td>'\+esc\(x\.landing\|\|'—'\)\+'<\/td><td>'\+esc\(x\.ata/);
});
test("le filtre de statut de la LISTE DES VOLS n'est plus injecté dans l'ADMIN ; l'écran ADMIN lit ses colonnes par leur nom",()=>{
  assert.match(src("./status-filter-ui.js"),/!b\.closest\('\.admin-native'\)/);
  const v5=src("./admin-dashboard-v5-wrapper.js");
  assert.match(v5,/cellText\(tr,'STD',3\)/);assert.match(v5,/cellText\(tr,'REG',10\)/);assert.ok(!/tr\.cells\?\.\[10\]/.test(v5));
});
