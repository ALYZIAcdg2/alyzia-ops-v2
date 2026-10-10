// VERROU DES RÈGLES : voir docs/REGLES_VERROUILLEES.md. Si ce test casse, une règle décidée avec l'exploitant a été modifiée.
// Ne le « corriger » qu'avec l'accord de l'exploitant, en mettant à jour docs/REGLES_VERROUILLEES.md dans la même PR.
import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
import {derive} from "./status-model-test.js";
import {lateBeyondStd15} from "./late-std15.js";
import {priority,needsLiveRead,flightComplete,deriveAta,fidsGone} from "./ops-public-live-flow-optimized.js";
import {fillStaFromFr24,needsFsRepair,flightStatsBlockTimes} from "./ops-public-live-flow-optimized.js";
import {flightAwareEnabled} from "./fa-policy.js";
import {wantsPage} from "./fids-flight-page.js";
const NOW=Date.parse("2026-10-09T20:00:00Z"),iso=m=>new Date(NOW+m*60000).toISOString();
const src=f=>fs.readFileSync(new URL(f,import.meta.url),"utf8");

test("R7 R8 — ARRIVÉ seulement avec une ATA ; jamais par ETA dépassée",()=>{
  const x={std:"18:00",atd:"18:05",takeoff:"18:15",eta:"19:30",origin:"CDG",destination:"CDG",flight_date:"2026-10-09"};
  for(const h of [20,23])assert.notEqual(derive(x,"2026-10-09",Date.UTC(2026,9,9,h,0)).status,"ARRIVÉ");
  assert.equal(derive(x,"2026-10-09",NOW).status,"EN VOL");
  assert.equal(derive({...x,landing:"19:40"},"2026-10-09",NOW).status,"ATTERRI");
  assert.equal(derive({...x,landing:"19:40",ata:"19:50"},"2026-10-09",NOW).status,"ARRIVÉ");
  assert.equal(derive({std:"18:00",atd:"18:05"},"2026-10-09",NOW).status,"PARTI");
  const code=src("./status-model-test.js")+src("./operational-state-wrapper.js");
  assert.ok(!/ETA_PASSED|estimated_arrival_plus_15/.test(code.replace(/\/\/[^\n]*/g,"")));
});
test("R9 — RETARDÉ : ETD de plus de 15 min, ou STD + 15 min sans ETD",()=>{
  const at=h=>Date.parse(`2026-10-09T${h}:00Z`);   // 13:00 UTC = 15:00 Paris
  assert.equal(lateBeyondStd15({std:"20:00",etd:"20:15"},"2026-10-09",at("13:00")),false);
  assert.equal(lateBeyondStd15({std:"20:00",etd:"20:16"},"2026-10-09",at("13:00")),true);
  assert.equal(lateBeyondStd15({std:"15:00"},"2026-10-09",at("12:59")),false);
  assert.equal(lateBeyondStd15({std:"15:00"},"2026-10-09",at("13:15")),true);
});
test("R11 — ETA dépassée de 15 min sans LDG/ATA : rang 0,1, avant tout autre vol",()=>{
  const x={std:"18:00",atd:"18:05",takeoff:"18:15",statusArrivalUtc:iso(-20)};
  assert.equal(priority({std:"18:00"},x,1100,NOW)[0],0.1);
  assert.ok(priority({std:"18:00"},x,1100,NOW)[0]<priority({std:"21:00"},{std:"21:00"},1100,NOW)[0]);
  assert.notEqual(priority({std:"18:00"},{...x,statusArrivalUtc:iso(-10)},1100,NOW)[0],0.1);
});
test("R12 — la page FIDS est relue à chaque passage (RETRY ≤ 2 min), jamais FlightStats élargi : pas de clause ataReadWanted",()=>{
  const f=src("./fids-flight-page.js");assert.match(f,/RETRY_MS=90\*1000/);
  assert.ok(!/ataReadWanted/.test(src("./ops-public-live-flow-optimized.js")));   // FlightStats n'est pas appelé sans raison : seulement quand le FIDS n'a plus accès (fidsGone)
});
test("R12 — la page FIDS du vol est lue pour un vol décollé SANS atterrissage connu (AH1115 / AH1543 / AH1083 / AH1013)",()=>{
  const ah={origin:"CDG",destination:"BJA",takeoff:"19:59",atd:"19:30",atdSource:"PUBLIC_LIVE:FIDS"};
  assert.equal(wantsPage(ah,NOW),true);
  assert.equal(wantsPage({...ah,ata:"21:10",ataSource:"PUBLIC_LIVE:FIDS"},NOW),false);   // déjà l'ATA du FIDS
  assert.equal(wantsPage({...ah,ata:"21:10",ataSource:"MANUAL"},NOW),false);               // jamais une saisie manuelle
  assert.equal(wantsPage({...ah,ata:"21:10",ataSource:"PUBLIC_LIVE:FLIGHTSTATS"},NOW),false);
});
test("R13 — un vol complet (ATA réelle + ATD) n'est plus lu ; une ATA calculée ne compte pas comme complète",()=>{
  const full={ata:"21:10",ataSource:"PUBLIC_LIVE:FIDS",atd:"19:30",atdSource:"PUBLIC_LIVE:FIDS",reg:"",std:"19:25"};
  assert.equal(flightComplete(full),true);
  assert.equal(needsLiveRead("2026-10-09","2026-10-09",full),false);
  assert.equal(needsLiveRead("2026-10-08","2026-10-09",full),false);
  assert.equal(flightComplete({...full,ataSource:"PUBLIC_LIVE:DERIVED_LANDING_PLUS_10"}),false);
  assert.equal(flightComplete({...full,atd:""}),false);
});
test("R3 — ATA calculée = atterrissage + 10 min, seulement 15 min après l'atterrissage (ENT / E4 tout de suite)",()=>{
  const now=new Date("2026-10-09T11:00:00Z");   // Paris 13:00
  assert.equal(deriveAta("12:50","Europe/Paris","TK",now),null);
  assert.deepEqual(deriveAta("12:30","Europe/Paris","TK",now)?.value,"12:40");
  assert.ok(deriveAta("12:55","Europe/Paris","ENT",now));
});
test("R1 — une STA présente n'est jamais modifiée ; vide : renseignée une fois",()=>{
  const x={sta:"22:45"};assert.equal(fillStaFromFr24(x,"23:00","t"),false);assert.equal(x.sta,"22:45");
  assert.equal(fillStaFromFr24({staSource:"MANUAL"},"23:00","t"),false);
});
test("R6 — FlightAware coupé par défaut",()=>{assert.equal(flightAwareEnabled(),false)});
test("R15 — étapes essentielles du passage jamais facultatives ; pages FIDS non sautables, avant les étapes lentes",()=>{
  const w=src("./v2-etd-public-wrapper.js");
  for(const n of ["gatenavo","fids-bulk","live-per-flight","fr24-board","status-model","status-model-final"])assert.ok(!new RegExp('B\\.step\\("'+n+'"[^\\n]*optional:true').test(w),n);
  assert.ok(!/B\.step\("fids-flight-pages"[^\n]*optional:true/.test(w),"pages FIDS jamais sautées");
  assert.match(w,/B\.step\("fids-flight-pages"[^\n]*ms:8000/);
  assert.ok(w.indexOf('B.step("fids-flight-pages"')<w.indexOf('B.step("status-model-final"'),"pages FIDS avant les statuts finaux");
  assert.ok(w.indexOf('B.step("fids-flight-pages"')<w.indexOf('B.step("fs-repair"')&&w.indexOf('B.step("fids-flight-pages"')<w.indexOf('B.step("etd-pass"'),"pages FIDS avant les étapes lentes");
});
test("R2 — seules deux ATD estimées existent (FIDS_ONTIME, FR24MOVE) ; la page FIDS ne remplace que celles-là",()=>{
  const f=src("./fids-flight-page.js");
  assert.match(f,/const atdOpen=x=>!clean\(x\.atd\)\|\|\/FIDS_ONTIME\|FR24MOVE\/\.test/);
});
test("le fichier des règles existe et liste les 18 règles",()=>{
  const d=src("../docs/REGLES_VERROUILLEES.md");for(let i=1;i<=18;i++)assert.match(d,new RegExp("^"+i+"\\. ","m"),"règle "+i);
});

test("R17 — relecture unique FlightStats : visées, exclues (manuelle, déjà faite), LDG = runway et ATA = gate, première valeur",()=>{
  const x={atd:"05:10",takeoff:"05:20",ata:"07:55",ataSource:"PUBLIC_LIVE:FIDS"};
  assert.equal(needsFsRepair(x),true);
  assert.equal(needsFsRepair({...x,fsRepairAt:"2026-10-10T01:00:00Z"}),false);
  assert.equal(needsFsRepair({...x,ataSource:"MANUAL"}),false);
  assert.equal(flightStatsBlockTimes("Scheduled -- Actual 20:48 CET Event Timeline Actual 20:51").actual,"20:48");
  const code=src("./ops-public-live-flow-optimized.js");
  assert.ok(code.includes('if(clean(current.landing)&&!/FLIGHTSTATS/.test(upper(current.landingSource)))landing.value=""'),"un LDG FR24 n'est pas remplacé");
});

test("R17 — la réparation FlightStats est une étape du cron à part, pas dans les lectures par vol",()=>{
  const w=src("./v2-etd-public-wrapper.js"),l=src("./ops-public-live-flow-optimized.js");
  assert.ok(w.includes('B.step("fs-repair"'),"étape fs-repair");
  assert.ok(!/needsLiveRead\(z\.r\.flight_date,date,z\.x\)\|\|needsFsRepair/.test(l),"pas dans la liste des lectures par vol");
  assert.ok(!l.includes("return [1.7"),"pas de rang 1,7");
});

test("R18 — TO FlightAware : usage étroit, étape du cron à part ; FlightAware général reste arrêté",()=>{
  const w=src("./v2-etd-public-wrapper.js"),f=src("./fa-takeoff.js"),p=src("./fa-policy.js");
  assert.ok(w.includes('B.step("fa-takeoff"')&&!/B\.step\("fa-takeoff"[^\n]*optional:true/.test(w)&&/B\.step\("fa-takeoff"[^\n]*ms:12000/.test(w),"étape à part, non sautable, 12 s au plus");
  assert.ok(/limit:1/.test(w.slice(w.indexOf('B.step("fa-takeoff"'),w.indexOf('B.step("fa-takeoff"')+120)),"un vol par passage");
  assert.match(f,/FIDS_ONTIME\|FR24MOVE/);assert.match(f,/takeoff:\s*value|takeoff:value/);
  assert.ok(!/atd:\s*(?:fa|d\.)/.test(f),"jamais d'ATD lue sur FlightAware");
  assert.match(p,/let enabled=false/,"FlightAware général arrêté");
  assert.match(p,/let takeoffEnabled=false;/,"TO FlightAware arrêté (défi anti-robot, 10/10)");
});
