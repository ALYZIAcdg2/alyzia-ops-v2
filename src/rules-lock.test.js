// VERROU DES RÈGLES : voir docs/REGLES_VERROUILLEES.md. Si ce test casse, une règle décidée avec l'exploitant a été modifiée.
// Ne le « corriger » qu'avec l'accord de l'exploitant, en mettant à jour docs/REGLES_VERROUILLEES.md dans la même PR.
import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
import {derive} from "./status-model-test.js";
import {lateBeyondStd15} from "./late-std15.js";
import {priority,needsLiveRead,flightComplete,deriveAta} from "./ops-public-live-flow-optimized.js";
import {fillStaFromFr24} from "./ops-public-live-flow-optimized.js";
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
test("R15 — étapes essentielles du passage jamais facultatives ; pages FIDS facultatives et en fin",()=>{
  const w=src("./v2-etd-public-wrapper.js");
  for(const n of ["gatenavo","fids-bulk","live-per-flight","fr24-board","status-model","status-model-final"])assert.ok(!new RegExp('B\\.step\\("'+n+'"[^\\n]*optional:true').test(w),n);
  assert.match(w,/B\.step\("fids-flight-pages"[^\n]*optional:true/);
  assert.ok(w.indexOf('B.step("fids-flight-pages"')>w.indexOf('B.step("status-model-final"'));
});
test("R2 — seules deux ATD estimées existent (FIDS_ONTIME, FR24MOVE) ; la page FIDS ne remplace que celles-là",()=>{
  const f=src("./fids-flight-page.js");
  assert.match(f,/const atdOpen=x=>!clean\(x\.atd\)\|\|\/FIDS_ONTIME\|FR24MOVE\/\.test/);
});
test("le fichier des règles existe et liste les 15 règles",()=>{
  const d=src("../docs/REGLES_VERROUILLEES.md");for(let i=1;i<=15;i++)assert.match(d,new RegExp("^"+i+"\\. ","m"),"règle "+i);
});
