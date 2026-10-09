import test from "node:test";
import assert from "node:assert/strict";
import {fr24IdFromLink,setFr24Link} from "./flight-fr24-link.js";
import {FLIGHT_RENAME_UI} from "./flight-rename-ui.js";
import {indexRows,matchRow} from "./fr24-board.js";
import fs from "node:fs";
test("identifiant FR24 lu dans l'adresse de la page du vol, ou saisi seul",()=>{
  assert.equal(fr24IdFromLink("https://www.flightradar24.com/ENT9ZW/420b0f1c"),"420b0f1c");
  assert.equal(fr24IdFromLink("https://www.flightradar24.com/data/flights/iz742#420823e9"),"420823e9");
  assert.equal(fr24IdFromLink("https://fr24.com/data/flights/tu2655/schedules/5876421672"),"");     // pas un identifiant d'occurrence
  assert.equal(fr24IdFromLink("420B0F1C"),"420b0f1c");
  assert.equal(fr24IdFromLink("20261009"),"");                                                    // une date n'en est pas un
  assert.equal(fr24IdFromLink("https://www.flightradar24.com/ENT9ZW/zzzzzzzz"),"");
  assert.equal(fr24IdFromLink(""),"");
});
function fakeDb(data){const calls=[];return {calls,OPS_DB:{prepare(sql){return {bind(...a){return {async first(){return sql.startsWith("SELECT")?{identity:a[0],data_json:JSON.stringify(data)}:null},async run(){calls.push({sql,a});return {meta:{changes:1}}}}}}}}}}
test("lien enregistré sur le vol : saisie manuelle, historique horodaté, vol relu en priorité",async()=>{
  const db=fakeDb({flight:"ENT9ZW",std:"09:30",publicLiveBackfill:{checkedAt:"x"}});
  const r=await setFr24Link(db,{identity:"2026-10-09|ENT|ENT9ZW",link:"https://www.flightradar24.com/ENT9ZW/420b0f1c",nowMs:Date.parse("2026-10-09T09:40:00Z")});
  assert.equal(r.ok,true);assert.equal(r.fr24OccurrenceId,"420b0f1c");
  const upd=db.calls.find(c=>c.sql.startsWith("UPDATE flights")),x=JSON.parse(upd.a[0]);
  assert.equal(x.fr24OccurrenceId,"420b0f1c");assert.equal(x.fr24OccurrenceIdSource,"MANUAL");assert.equal(x.publicLiveBackfill,undefined);
  assert.deepEqual(x.flightInfoLog[0],{at:"2026-10-09T09:40:00.000Z",source:"MANUAL",field:"fr24",from:"",to:"420b0f1c"});
  const bad=await setFr24Link(db,{identity:"x",link:"n'importe quoi"});assert.equal(bad.error,"LIEN_INVALIDE");
  const dry=await setFr24Link(fakeDb({}),{identity:"x",link:"420b0f1c",dryRun:true});assert.equal(dry.dryRun,true);
});
test("tableau FR24 : un vol sans numéro commercial est retrouvé par son indicatif",()=>{
  const STD=Date.parse("2026-10-09T07:45:00Z")/1000;   // 09:45 Paris
  const idx=indexRows([{flight:"",callsign:"ENT9ZW",std:STD,time:STD,status:"departed"}]);
  const row=matchRow(idx,{date:"2026-10-09",airline:"ENT",number:"9ZW",designator:"ENT9ZW",std:"09:30"});   // STD 15 min plus tôt chez nous
  assert.ok(row);assert.equal(row.callsign,"ENT9ZW");
});
test("fiche : le bloc LIEN FR24 est dans INFOS VOL et appelle l'API",()=>{
  const js=/<script[^>]*>([\s\S]*)<\/script>/.exec(FLIGHT_RENAME_UI)[1];
  assert.doesNotThrow(()=>new Function(js));
  assert.match(js,/LIEN FR24 DU VOL/);assert.match(js,/\/api\/flights\/fr24-link/);
  assert.match(fs.readFileSync(new URL("./v2-etd-public-wrapper.js",import.meta.url),"utf8"),/\/api\/flights\/fr24-link/);
});
