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

import {flightStatsDetails} from "./ops-public-live-flow-optimized.js";
const MH21={designator:"MH21",airline:"MH",number:"21"};
const detailsInterleaved="(MH) Malaysia Airlines 21 Flight Details On time | Departed Departure CDG Paris Charles de Gaulle Airport, FR Flight Gate Times 05-Oct-2026 Scheduled 11:20 CEST Actual 11:50 CEST Total Departure Delay: 30 mins Flight Runway Times 05-Oct-2026 Scheduled -- Actual 12:03 CEST Runway Delay: - Terminal 2A Gate A39 Craft Type Airbus A350-900 Arrival KUL Kuala Lumpur International Airport, MY Flight Gate Times 06-Oct-2026 Scheduled 05:55 UTC+08:00 Estimated 06:01 UTC+08:00 Total Arrival Delay: 6 mins Flight Runway Times 06-Oct-2026 Scheduled -- Actual -- Runway Delay: - Terminal 1 Gate - Baggage Claim - Tail Number 9M-MAC";
test("FlightStats details page: gate departure 11:50 is the ATD, runway 12:03 the takeoff, arrival estimate 06:01 (MH21)",()=>{
  const d=flightStatsDetails(detailsInterleaved);
  assert.equal(d.atd,"11:50");assert.equal(d.takeoff,"12:03");assert.equal(d.eta,"06:01");assert.equal(d.ata,"");assert.equal(d.landing,"");
  const out=semanticText("FLIGHTSTATS",detailsInterleaved,MH21);
  assert.equal(out.atd,"11:50");assert.equal(out.takeoff,"12:03");assert.equal(out.eta,"06:01");assert.equal(out.ata,undefined);
});
test("FlightStats details page, labels above values: arrival gate Actual = ATA and arrival runway Actual = landing",()=>{
  const t="Departure Flight Gate Times Scheduled Actual 11:20 CEST 11:50 CEST Flight Runway Times Scheduled Actual -- 12:03 CEST Terminal Arrival Flight Gate Times Scheduled Actual 05:55 UTC+08:00 06:20 UTC+08:00 Flight Runway Times Scheduled Actual -- 06:12 UTC+08:00 Terminal";
  const d=flightStatsDetails(t);
  assert.equal(d.atd,"11:50");assert.equal(d.takeoff,"12:03");assert.equal(d.ata,"06:20");assert.equal(d.landing,"06:12");
});

import {flightStatsFlightId} from "./ops-public-live-flow-optimized.js";
test("the tracker page link of the requested date gives the FlightStats flightId (MH21)",()=>{
  const raw='<a href="/v2/flight-details/MH/21?year=2026&amp;month=10&amp;date=4&amp;flightId=1411000001">x</a><a href="/v2/flight-details/MH/21?year=2026&amp;month=10&amp;date=5&amp;flightId=1412343320">view details</a>';
  assert.equal(flightStatsFlightId(raw,"2026-10-05"),"1412343320");
  assert.equal(flightStatsFlightId(raw,"2026-10-06"),"");
  assert.equal(flightStatsFlightId("<html>no link</html>","2026-10-05"),"");
});

import {priority,suspectAtd} from "./ops-public-live-flow-optimized.js";
test("an ATD copied from the FR24 takeoff is read first by the cron",()=>{
  const x={std:"11:20",atd:"12:02",takeoff:"12:02",atdSource:"PUBLIC_LIVE:FR24"};
  assert.equal(suspectAtd(x),true);
  assert.equal(priority({std:"11:20"},x,742)[0],0);
  assert.equal(suspectAtd({...x,atdSource:"PUBLIC_LIVE:FLIGHTSTATS"}),false);
  assert.equal(suspectAtd({...x,atdSource:"MANUAL",atd:"12:02"}),false);
  assert.equal(priority({std:"11:20"},{...x,atdSource:"PUBLIC_LIVE:FLIGHTSTATS"},742)[0],1);
});

import {arrivingSoon} from "./ops-public-live-flow-optimized.js";
test("airborne flights arriving within 2 h are re-read first, at most every 3 minutes",()=>{
  const now=Date.UTC(2026,9,5,10,0),iso=min=>new Date(now+min*60000).toISOString();
  const soon={std:"08:00",atd:"08:10",takeoff:"08:20",statusArrivalUtc:iso(90),publicLiveBackfill:{checkedAt:iso(-10)}};
  assert.equal(arrivingSoon(soon,now),true);
  assert.equal(priority({std:"08:00"},soon,600,now)[0],0.5);
  assert.equal(priority({std:"08:00"},{...soon,publicLiveBackfill:{checkedAt:iso(-1)}},600,now)[0],1);
  assert.equal(priority({std:"08:00"},{...soon,statusArrivalUtc:iso(400)},600,now)[0],1);
  assert.equal(arrivingSoon({...soon,ata:"11:00"},now),false);
  assert.equal(arrivingSoon({...soon,statusArrivalUtc:iso(-40)},now),false);
});

test("a flight that took off without ATD is asked again by the cron (FlightStats / FlightAware)",()=>{
  const now=Date.UTC(2026,9,5,10,30),iso=min=>new Date(now+min*60000).toISOString();
  const x={std:"11:10",takeoff:"12:09",dep:"CDG",publicLiveBackfill:{checkedAt:iso(-10)}};   // 12:09 Paris = 10:09 UTC, 21 min ago
  assert.equal(priority({std:"11:10"},x,750,now)[0],0.4);
  assert.equal(priority({std:"11:10"},{...x,publicLiveBackfill:{checkedAt:iso(-2)}},750,now)[0],1);
  assert.equal(priority({std:"11:10"},{...x,atd:"11:50"},750,now)[0],1);
  assert.equal(priority({std:"08:00"},{...x,takeoff:"08:10"},750,now)[0],1);
});

test("flightId found in the path form and in the JSON data of the page (TS111, 5 Oct)",()=>{
  const path='"url":"/flight-details/TS/111/2026/10/5/1412363884","carrier":{"flightNumber":"111"}';
  assert.equal(flightStatsFlightId(path,"2026-10-05"),"1412363884");
  assert.equal(flightStatsFlightId(path,"2026-10-04"),"");
  const json='"extendedDetails":{"sortTime":"2026-10-05T10:20:00.000Z","flightId":1412363884,"carrier":{"fs":"TS"},"departureAirport":{"fs":"CDG","times":{},"date":"2026-10-05T12:20:00.000"}}';
  assert.equal(flightStatsFlightId(json,"2026-10-05"),"1412363884");
  const two=path+',"flightId":1411111111,"x":{"date":"2026-10-05T01:00:00.000"}';
  assert.equal(flightStatsFlightId(two,"2026-10-05"),"");
});
test("FlightStats details page of TS111: gate 12:20, runway 12:34, arrival estimates 13:40 / 13:26 (not landing)",()=>{
  const t="(TS) Air Transat 111 Flight Details On time | Departed Departure CDG Flight Gate Times 05-Oct-2026 Scheduled 12:20 CEST Actual 12:20 CEST Total Departure Delay: - Flight Runway Times 05-Oct-2026 Scheduled 12:30 CEST Actual 12:34 CEST Runway Delay: 4 mins Terminal 3 Gate - Craft Type Airbus A330-200 Arrival YUL Flight Gate Times 05-Oct-2026 Scheduled 14:00 EDT Estimated 13:40 EDT Total Arrival Delay: - Flight Runway Times 05-Oct-2026 Scheduled 13:56 EDT Estimated 13:26 EDT Runway Delay: - Terminal - Gate -";
  const d=flightStatsDetails(t);
  assert.equal(d.atd,"12:20");assert.equal(d.takeoff,"12:34");assert.equal(d.eta,"13:40");assert.equal(d.ata,"");assert.equal(d.landing,"");
});

import {flightStatsApiTimes} from "./ops-public-live-flow-optimized.js";
// Réponse réelle de https://www.flightstats.com/v2/api/extendedDetails/TS/111/2026/10/5/1412363884 (vol en route, 5 oct 2026), champs utiles.
const TS111_API={flightId:1412363884,departureTimes:{scheduledGate:{time24:"12:20"},actualGate:{time24:"12:20"},scheduledRunway:{time24:"12:30"},actualRunway:{time24:"12:34"}},arrivalTimes:{scheduledGate:{time24:"14:00"},estimatedGate:{time24:"13:40"},scheduledRunway:{time24:"13:56"},estimatedRunway:{time24:"13:26"}},status:{statusCode:"A",status:"Departed",diverted:false},divertedAirport:null,flightState:"en-route",additionalFlightInfo:{equipment:{tailNumber:"C-GUBT",iata:"332",name:"Airbus A330-200"}}};
test("FlightStats JSON API (TS111): gate 12:20 = ATD, runway 12:34 = takeoff, estimated gate 13:40 = ETA, tail and aircraft",()=>{
  const a=flightStatsApiTimes(TS111_API);
  assert.deepEqual(a,{atd:"12:20",takeoff:"12:34",eta:"13:40",status:"EN VOL",reg:"C-GUBT",aircraft:"332"});
});
test("FlightStats JSON API: landed flight gives landing and ATA, a cancelled one is a strong ANNULÉ",()=>{
  const landed=flightStatsApiTimes({...TS111_API,arrivalTimes:{actualRunway:{time24:"13:30"},actualGate:{time24:"13:41"},estimatedGate:{time24:"13:40"}},flightState:"landed"});
  assert.equal(landed.landing,"13:30");assert.equal(landed.ata,"13:41");assert.equal(landed.eta,undefined);assert.equal(landed.status,"ARRIVÉE");
  const onlyRunway=flightStatsApiTimes({...TS111_API,arrivalTimes:{actualRunway:{time24:"13:30"}}});
  assert.equal(onlyRunway.status,"ATTERI");
  const cancelled=flightStatsApiTimes({status:{statusCode:"C",status:"Cancelled"},departureTimes:{},arrivalTimes:{}});
  assert.equal(cancelled.status,"ANNULÉ");assert.equal(cancelled.statusStrong,true);
});

import {flightStatsNoteResult,flightStatsPaused,flightStatsReset} from "./ops-public-live-flow-optimized.js";
test("FlightStats is paused for 90 s after two refusals in a row, and a success resets the count",()=>{
  flightStatsReset();const t=Date.UTC(2026,9,5,10,0);
  flightStatsNoteResult(403,t);assert.equal(flightStatsPaused(t+1),false);
  flightStatsNoteResult(200,t);flightStatsNoteResult(429,t);assert.equal(flightStatsPaused(t+1),false);
  flightStatsNoteResult(403,t);assert.equal(flightStatsPaused(t+1000),true);
  assert.equal(flightStatsPaused(t+91000),false);
  flightStatsReset();
});
test("N2U est une immatriculation invalide",async()=>{const {isJunkRegistration}=await import("./registration-guard.js");assert.equal(isJunkRegistration("N2U"),true);assert.equal(isJunkRegistration("E-MAIL"),true);assert.equal(isJunkRegistration("N781AN"),false);assert.equal(isJunkRegistration("HL7579"),false);assert.equal(isJunkRegistration("F-GSPL"),false)});
