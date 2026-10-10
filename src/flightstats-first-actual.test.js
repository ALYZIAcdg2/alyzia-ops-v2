import test from "node:test";import assert from "node:assert/strict";
import {flightStatsDetails} from "./ops-public-live-flow-optimized.js";
// Texte réel de la page FlightStats d'AH1115 (09/10/2026) : l'historique en bas répète « Actual » avec d'autres heures.
const PAGE="CDG Paris Charles de Gaulle Airport, FR Flight Gate Times 09-Oct-2026 Scheduled 19:25 CEST Actual 19:30 CEST Total Departure Delay: 5 mins Flight Runway Times 09-Oct-2026 Scheduled -- Actual 19:59 CEST Runway Delay: - Terminal 2D Gate B23 Craft Type Boeing 737-800 Flight Time Scheduled 2h 15m Arrival BJA Bejaia Soummam Abane Ramdane Airport, DZ Flight Gate Times 09-Oct-2026 Scheduled 20:40 CET Actual 20:53 CET Total Arrival Delay: 13 mins Flight Runway Times 09-Oct-2026 Scheduled -- Actual 20:48 CET Runway Delay: - Terminal - Gate - Baggage Claim - Tail Number 7T-VKM Flight Time Actual 2h 23m VIEW FLIGHT STATUS Event Timeline Time Date UTC CEST CET Event Data Updated 9 Oct 20:14 22:14 21:14 Time Adjustment Estimated Runway Arrival changed from Oct-09-2026 8:47 PM to 8:51 PM Actual 20:51 Actual 20:52";
test("FlightStats : atterrissage = première valeur « Actual » du bloc, pas l'historique",()=>{
  const d=flightStatsDetails(PAGE);
  assert.equal(d.landing,"20:48");assert.equal(d.ata,"20:53");assert.equal(d.atd,"19:30");assert.equal(d.takeoff,"19:59");
});
