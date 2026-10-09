import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {normalizeNewFlight,renamedFlightData,renameFlight,identityOf} from "./flight-rename.js";
import {FLIGHT_RENAME_UI} from "./flight-rename-ui.js";
test("numéro valide : même compagnie, 1 à 4 chiffres",()=>{
  assert.equal(normalizeNewFlight("ent 580","ENT"),"ENT580");
  assert.equal(normalizeNewFlight("tu2655","TU"),"TU2655");
  assert.equal(normalizeNewFlight("AF12A","AF"),"AF12A");
  assert.equal(normalizeNewFlight("AF","AF"),"");
  assert.equal(normalizeNewFlight("TU655","AF"),"");           // autre compagnie
  assert.equal(normalizeNewFlight("AF12345","AF"),"");
  assert.equal(normalizeNewFlight("AF1 2","AF"),"AF12");
});
test("l'historique garde l'horodatage, l'ancien numéro ; les identifiants de lecture de l'ancien numéro sont retirés",()=>{
  const x={flight:"ENT579",designator:"ENT579",std:"09:30",fr24OccurrenceId:"abc",flightStatsId:"123",flightStatsIdDate:"2026-10-09",publicLiveBackfill:{checkedAt:"x"},flightInfoLog:[{field:"gate"}]};
  const r=renamedFlightData(x,"ENT580","2026-10-09T03:30:00.000Z");
  assert.equal(r.flight,"ENT580");assert.equal(r.designator,"ENT580");assert.equal(r.std,"09:30");
  assert.deepEqual(r.flightInfoLog[0],{at:"2026-10-09T03:30:00.000Z",source:"MANUAL",field:"flight",from:"ENT579",to:"ENT580"});
  assert.equal(r.flightRenamedFrom,"ENT579");assert.equal(r.fr24OccurrenceId,undefined);assert.equal(r.flightStatsId,undefined);assert.equal(r.publicLiveBackfill,undefined);
  assert.equal(x.fr24OccurrenceId,"abc");                         // l'original n'est pas modifié
});
function fakeDb(rows){
  const calls=[];
  return {calls,OPS_DB:{prepare(sql){return {bind(...a){return {
    async first(){if(sql.includes("WHERE identity=? LIMIT 1")&&sql.startsWith("SELECT identity,flight_date"))return rows.find(r=>r.identity===a[0])||null;if(sql.startsWith("SELECT identity FROM flights"))return rows.find(r=>r.identity===a[0])||null;return null},
    async run(){calls.push({sql,a});return {meta:{changes:1}}}}}}}}};
}
const row=o=>({identity:identityOf("2026-10-09","ENT","ENT579"),flight_date:"2026-10-09",airline:"ENT",flight_number:"ENT579",std:"09:30",data_json:JSON.stringify({flight:"ENT579",airline:"ENT",date:"2026-10-09",std:"09:30"}),...o});
test("renommage : le vol et ce qui s'y rattache changent d'identité, avec horodatage",async()=>{
  const db=fakeDb([row()]);
  const r=await renameFlight(db,{identity:"2026-10-09|ENT|ENT579",newFlight:"ent580",nowMs:Date.parse("2026-10-09T03:30:00Z")});
  assert.equal(r.ok,true);assert.equal(r.newIdentity,"2026-10-09|ENT|ENT580");assert.equal(r.at,"2026-10-09T03:30:00.000Z");
  const upd=db.calls.find(c=>c.sql.startsWith("UPDATE flights"));
  assert.equal(upd.a[0],"2026-10-09|ENT|ENT580");assert.equal(upd.a[1],"ENT580");assert.equal(upd.a[3],"2026-10-09|ENT|ENT579");
  assert.equal(JSON.parse(upd.a[2]).flightInfoLog[0].to,"ENT580");
  for(const t of ["flight_notes","flight_attachments","lot5_drive_folders","prepa_inbox"])assert.ok(db.calls.some(c=>c.sql.includes(t)),t+" migré");
  assert.ok(db.calls.some(c=>c.sql.includes("flights_epoch")));
});
test("refus : numéro invalide, identique, déjà utilisé, vol introuvable ; aperçu sans écriture",async()=>{
  const other=row({identity:"2026-10-09|ENT|ENT580",flight_number:"ENT580"});
  const db=fakeDb([row(),other]);
  assert.equal((await renameFlight(db,{identity:"2026-10-09|ENT|ENT579",newFlight:"AF12"})).error,"NUMERO_INVALIDE");
  assert.equal((await renameFlight(db,{identity:"2026-10-09|ENT|ENT579",newFlight:"ENT579"})).error,"NUMERO_IDENTIQUE");
  assert.equal((await renameFlight(db,{identity:"2026-10-09|ENT|ENT579",newFlight:"ENT580"})).error,"NUMERO_DEJA_UTILISE");
  assert.equal((await renameFlight(db,{identity:"x|y|z",newFlight:"ENT581"})).error,"VOL_INTROUVABLE");
  const p=await renameFlight(db,{identity:"2026-10-09|ENT|ENT579",newFlight:"ENT581",dryRun:true});
  assert.equal(p.ok,true);assert.equal(p.dryRun,true);assert.equal(db.calls.length,0);
});
test("fiche : script d'interface valide, branché sur INFOS VOL et injecté dans la page",()=>{
  const js=/<script[^>]*>([\s\S]*)<\/script>/.exec(FLIGHT_RENAME_UI)[1];
  assert.doesNotThrow(()=>new Function(js));
  assert.match(js,/openFlightInfo/);assert.match(js,/\/api\/flights\/rename/);assert.match(js,/MODIFIÉ LE/);
  const w=fs.readFileSync(new URL("./v2-etd-public-wrapper.js",import.meta.url),"utf8");
  assert.match(w,/FLIGHT_RENAME_UI/);assert.match(w,/\/api\/flights\/rename/);
});

test("fiche : seul le numéro est modifiable (chiffres, ou chiffres + une lettre), le code compagnie reste fixe",()=>{
  const js=/<script[^>]*>([\s\S]*)<\/script>/.exec(FLIGHT_RENAME_UI)[1];
  const grab=n=>new RegExp("function "+n+"\\([^)]*\\)\\{[^\\n]*\\}").exec(js)[0];
  const fns=new Function(grab("airlineOf")+grab("suffixOf")+grab("cleanSuffix")+";return {airlineOf,suffixOf,cleanSuffix}")();
  assert.equal(fns.airlineOf({airline:"ENT",flight:"ENT579"}),"ENT");
  assert.equal(fns.suffixOf({airline:"ENT",flight:"ENT579"}),"579");
  assert.equal(fns.suffixOf({airline:"AF",flight:"AF12A"}),"12A");
  assert.equal(fns.cleanSuffix("579"),"579");
  assert.equal(fns.cleanSuffix("579a"),"579A");
  assert.equal(fns.cleanSuffix("5-7 9"),"579");
  assert.equal(fns.cleanSuffix("12345"),"1234");          // 4 chiffres au plus
  assert.equal(fns.cleanSuffix("A12"),"");                // doit commencer par un chiffre
  assert.equal(normalizeNewFlight("ENT"+fns.cleanSuffix("579a"),"ENT"),"ENT579A");
  assert.match(js,/alz-rename-prefix/);assert.match(js,/579 ou 579A/);
});
