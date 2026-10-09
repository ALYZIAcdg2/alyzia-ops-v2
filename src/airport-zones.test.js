import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {AIRPORT_TZ,tzOffsetMinutes,loadAirportZones,__resetAirportZones} from "./airport-tz.js";
import {fr24Semantic} from "./ops-public-live-flow-optimized.js";
const real=JSON.parse(fs.readFileSync(new URL("../public/airports.json",import.meta.url),"utf8"));
const env={ASSETS:{fetch:async()=>new Response(JSON.stringify(real),{status:200})}};
test("Mykonos (JMK) : sans la table complète, l'heure locale retombait sur Paris",async()=>{
  __resetAirportZones();delete AIRPORT_TZ.JMK;
  const summer=new Date("2026-10-09T10:00:00Z");
  assert.equal(tzOffsetMinutes("JMK",summer),120);                 // Paris par défaut : faux
  await loadAirportZones(env);
  assert.equal(AIRPORT_TZ.JMK,"Europe/Athens");
  assert.equal(tzOffsetMinutes("JMK",summer),180);                 // Mykonos : UTC+3
  // l'ETA FR24 (11:29 UTC) s'affiche en heure de Mykonos
  const eta=fr24Semantic({candidates:{semantic:{eta:"2026-10-09T11:29:00.000Z"}}},{origin:"CDG",destination:"JMK"}).eta;
  assert.equal(eta,"14:29");
});
test("la liste existante reste prioritaire ; un chargement impossible ne casse rien",async()=>{
  __resetAirportZones();
  const before=AIRPORT_TZ.CDG;
  await loadAirportZones({ASSETS:{fetch:async()=>new Response(JSON.stringify({CDG:["X","Asia/Tokyo","LFPG"]}),{status:200})}});
  assert.equal(AIRPORT_TZ.CDG,before);
  __resetAirportZones();
  await loadAirportZones({ASSETS:{fetch:async()=>{throw new Error("hors ligne")}}});
  await loadAirportZones({});
  assert.equal(AIRPORT_TZ.CDG,before);
  __resetAirportZones();
});
test("branché sur le cron et sur les routes /api",()=>{
  const w=fs.readFileSync(new URL("./v2-etd-public-wrapper.js",import.meta.url),"utf8");
  assert.match(w,/startsWith\("\/api\/"\)\)await loadAirportZones\(env\)/);
  assert.match(w,/await loadAirportZones\(env\);   \/\/ fuseaux/);
});
