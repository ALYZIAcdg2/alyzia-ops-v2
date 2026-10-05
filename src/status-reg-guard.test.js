import test from "node:test";
import assert from "node:assert/strict";
import {pickStatus,LIVE_PUBLIC_SOURCE_ORDER,fr24Semantic} from "./ops-public-live-flow-optimized.js";
import {isWebWordRegistration} from "./registration-guard.js";

test("a single source saying ANNULÉ is ignored",()=>{
  const map={FLIGHTSTATS:{status:"ANNULÉ"},FR24:{status:"EN VOL"}};
  assert.equal(pickStatus(map,LIVE_PUBLIC_SOURCE_ORDER.status).value,"EN VOL");
  assert.equal(pickStatus({SKYSCANNER:{status:"ANNULÉ"}},LIVE_PUBLIC_SOURCE_ORDER.status).value,"");
});
test("ANNULÉ is kept when two sources agree",()=>{
  const map={FR24:{status:"ANNULÉ"},FLIGHTSTATS:{status:"ANNULÉ"}};
  assert.equal(pickStatus(map,LIVE_PUBLIC_SOURCE_ORDER.status).value,"ANNULÉ");
});
test("ON-TIME is not a registration",()=>{
  assert.ok(isWebWordRegistration("ON-TIME"));
  assert.ok(!isWebWordRegistration("TS-IMX"));
  assert.ok(!isWebWordRegistration("EC-NCK"));
});

import {guardAirborneStatus} from "./ops-public-live-flow-optimized.js";
test("EN VOL / ARRIVÉE without any departure fact is refused",()=>{
  assert.equal(guardAirborneStatus("EN VOL",{std:"21:00",etd:"01:10",status:"RETARDÉ"}),"RETARDÉ");
  assert.equal(guardAirborneStatus("ARRIVÉE",{std:"20:45"}),"PRÉVU");
  assert.equal(guardAirborneStatus("EN VOL",{std:"21:00",etd:"23:10"}),"RETARDÉ");
});
test("EN VOL is kept when the flight has an ATD",()=>{
  assert.equal(guardAirborneStatus("EN VOL",{atd:"21:12"}),"EN VOL");
  assert.equal(guardAirborneStatus("ARRIVÉE",{takeoff:"12:17"}),"ARRIVÉE");
  assert.equal(guardAirborneStatus("RETARDÉ",{}),"RETARDÉ");
});

import {semanticText} from "./ops-public-live-flow-optimized.js";
test("a FlightStats page of a diverted flight reads DÉROUTÉ",()=>{
  const page="(SQ) Singapore Airlines 337 Flight Details Diverted to CDG Flight Diverted SQ337 Flight Departure Times Actual 00:41 Flight Arrival Times Actual 00:59";
  assert.equal(semanticText("FLIGHTSTATS",page,{designator:"SQ337",airline:"SQ",number:"337"}).status,"DÉROUTÉ");
});
test("a single DÉROUTÉ is not believed",()=>{
  assert.equal(pickStatus({FLIGHTSTATS:{status:"DÉROUTÉ"},FR24:{status:"EN VOL"}},LIVE_PUBLIC_SOURCE_ORDER.status).value,"EN VOL");
  assert.equal(pickStatus({FLIGHTSTATS:{status:"DÉROUTÉ"}},LIVE_PUBLIC_SOURCE_ORDER.status).value,"");
});
test("FlightStats runway actual of the departure is read as takeoff",()=>{
  const page="Flight Gate Times 04-Oct-2026 Scheduled 22:35 CEST Actual 00:41 CEST Flight Runway Times 04-Oct-2026 Scheduled -- Actual 00:58 CEST Terminal 1 Gate 26 Arrival SIN Flight Gate Times Scheduled 17:40";
  const r=semanticText("FLIGHTSTATS",page,{designator:"SQ337",airline:"SQ",number:"337"});
  assert.equal(r.takeoff,"00:58");
});

import {confirmation} from "./ops-public-live-flow-optimized.js";
test("a time is confirmed when two sources agree within 2 minutes",()=>{
  const map={FLIGHTSTATS:{atd:"00:41"},FLIGHTAWAREEXACT:{atd:"00:42"},FR24:{atd:"00:58"}};
  assert.deepEqual(confirmation(map,"atd","00:41"),{confirmed:true,sources:["FLIGHTSTATS","FLIGHTAWAREEXACT"]});
  assert.equal(confirmation(map,"atd","00:58").confirmed,false);
  assert.equal(confirmation({FR24:{eta:"23:59"},FLIGHTSTATS:{eta:"00:01"}},"eta","23:59").confirmed,true);
});

import {minutesOnFlightDay} from "./ops-public-live-flow-optimized.js";
test("after midnight an evening departure of yesterday is in the past",()=>{
  assert.equal(minutesOnFlightDay("2026-10-04","2026-10-05",99),1539);
  assert.equal(minutesOnFlightDay("2026-10-05","2026-10-05",99),99);
  assert.equal(minutesOnFlightDay("2026-10-05","2026-10-04",99),99);
});
test("a cancellation stated in the FlightStats banner wins alone",()=>{
  const page="(AI) Air India 142 Flight Tracker AI 142 CDG DEL Cancelled Flight Departure Times 04-Oct-2026 Scheduled 20:45 CEST Flight Arrival Times Scheduled 10:25";
  const r=semanticText("FLIGHTSTATS",page,{designator:"AI142",airline:"AI",number:"142"});
  assert.equal(r.status,"ANNULÉ");assert.ok(r.statusStrong);
  assert.equal(pickStatus({FLIGHTSTATS:r,FR24:{status:"EN VOL"}},LIVE_PUBLIC_SOURCE_ORDER.status).value,"ANNULÉ");
});

import {deriveAta,minutesSinceLocalClock} from "./ops-public-live-flow-optimized.js";
test("landed for 15 minutes without ATA: ATA = landing + 10",()=>{
  const now=new Date("2026-10-04T15:00:00Z"); // 17:00 Paris
  assert.equal(minutesSinceLocalClock("16:40","Europe/Paris",now),20);
  assert.deepEqual(deriveAta("16:40","Europe/Paris","PC",now),{value:"16:50",source:"DERIVED_LANDING_PLUS_10"});
  assert.equal(deriveAta("16:50","Europe/Paris","PC",now),null);
  assert.equal(deriveAta("16:50","Europe/Paris","ENT",now)?.value,"17:00");
  assert.equal(deriveAta("",  "Europe/Paris","PC",now),null);
});
test("FlightStats cancelled banner without the usual time blocks is still read",()=>{
  const page="Track a Flight (AI) Air India 142 Flight Details Cancelled Flight Cancelled One or more of our data sources have indicated that this flight has been cancelled. Please contact the airline for more details. CDG Paris DEL Delhi Scheduled 20:45 CEST";
  const r=semanticText("FLIGHTSTATS",page,{designator:"AI142",airline:"AI",number:"142"});
  assert.equal(r.status,"ANNULÉ");assert.ok(r.statusStrong);
});

import {derive} from "./status-model-test.js";
test("the status model keeps a cancellation confirmed by the live flow",()=>{
  const x={flight:"AI142",std:"20:45",sta:"10:25",dep:"CDG",dest:"DEL",status:"ANNULÉ",cancelledSource:"FLIGHTSTATS"};
  assert.equal(derive(x,"2026-10-04").status,"ANNULÉ");
  assert.notEqual(derive({...x,cancelledSource:undefined,status:"PRÉVU"},"2026-10-04").status,"ANNULÉ");
});
test("a stored ANNULÉ written by the live flow (no marker) is kept by the status model",()=>{
  const x={flight:"AI142",std:"20:45",sta:"10:25",dep:"CDG",dest:"DEL",status:"ANNULÉ",statusSource:"PUBLIC_LIVE:FLIGHTSTATS"};
  assert.equal(derive(x,"2026-10-04").status,"ANNULÉ");
  assert.equal(derive({...x,statusSource:"ALYZIA_STATUS_V1:CANCELLED:V2_PUBLIC"},"2026-10-04").status,"ANNULÉ");
});

import {flightStatsSlot} from "./ops-public-live-flow-optimized.js";
test("FlightStats requests are serialised, other sources are not",async()=>{
  let running=0,max=0;const job=()=>new Promise(r=>{running++;max=Math.max(max,running);setTimeout(()=>{running--;r()},15)});
  await Promise.all([1,2,3].map(()=>flightStatsSlot("FLIGHTSTATS",job,1)));
  assert.equal(max,1);
  max=0;await Promise.all([1,2,3].map(()=>flightStatsSlot("PLANEFINDER",job,1)));
  assert.equal(max,3);
});

test("a 3-character flight number is not read as an aircraft type (LY320 -> 320)",()=>{
  const f={designator:"LY320",airline:"LY",number:"320"};
  const out=semanticText("PLANEFINDER","Flight LY 320 Paris CDG to Tel Aviv TLV scheduled 11:10 arrival 16:40",f);
  assert.equal(out.aircraft||"","");
  const real=semanticText("PLANEFINDER","Flight LY 320 Paris CDG to Tel Aviv TLV aircraft B739 scheduled 11:10",f);
  assert.equal(real.aircraft,"B739");
});

test("FR24 feeds TAKEOFF only: its actual departure is never used as ATD",()=>{
  const sem=fr24Semantic({candidates:{semantic:{atdClock:"12:02",takeoff:"2026-10-05T10:02:00.000Z"}}},{destination:"KUL"});
  assert.equal(sem.atd,undefined);
  assert.equal(sem.takeoff,"12:02");
});

test("MH21: with a playback takeoff 12:03 and a history clock 12:02, FR24 still gives no ATD",()=>{
  const sem=fr24Semantic({candidates:{semantic:{atdClock:"12:02",takeoff:"2026-10-05T10:03:00.000Z"}}},{destination:"KUL"});
  assert.equal(sem.atd,undefined);
  assert.equal(sem.takeoff,"12:03");
});
