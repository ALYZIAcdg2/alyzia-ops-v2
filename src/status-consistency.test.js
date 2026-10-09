import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
const src=fs.readFileSync(new URL("./v2-ui-consistency-wrapper.js",import.meta.url),"utf8");
const fn=/function opStatus\(x\)\{[^\n]*\}/.exec(src)[0];
const up=v=>String(v??"").trim().toUpperCase(),txt=v=>String(v??"").trim();
const mk=()=>new Function("up","txt","times","remaining","statusClass",fn+";return opStatus")(up,txt,x=>({ata:x.ata||"",landing:x.landing||"",takeoff:x.takeoff||"",atd:x.atd||"",etd:x.etd||""}),()=>"1h",s=>String(s).toLowerCase());
test("ETA dépassée de 15 min (statut du modèle) : la fiche et la carte affichent ARRIVÉ comme l'ADMIN, même sans ATA ni atterrissage",()=>{
  const opStatus=mk();
  const x={status:"ARRIVÉ",statusSource:"ALYZIA_STATUS_V1:ETA_PASSED_15:V2_PUBLIC",atd:"21:16",takeoff:"21:30"};
  assert.equal(opStatus(x).main,"ARRIVÉ");assert.equal(opStatus(x).remain,"");
});
test("sans ce statut du modèle, un vol décollé reste EN VOL ; une ATA donne toujours ARRIVÉ",()=>{
  const opStatus=mk();
  assert.equal(opStatus({status:"EN VOL",statusSource:"ALYZIA_STATUS_V1:TAKEOFF:PUBLIC_LIVE:FR24BOARD",atd:"21:16",takeoff:"21:30"}).main,"EN VOL");
  assert.equal(opStatus({status:"ARRIVÉ",statusSource:"ALYZIA_STATUS_V1:ETA_PASSED_15:V2",atd:"21:16",takeoff:"21:30",ata:"22:30"}).main,"ARRIVÉ");
  assert.equal(opStatus({status:"EN VOL",statusSource:"ALYZIA_STATUS_V1:ETA_PASSED_15:V2",atd:"21:16",takeoff:"21:30"}).main,"EN VOL");   // statut stocké pas ARRIVÉ : on ne force rien
});
