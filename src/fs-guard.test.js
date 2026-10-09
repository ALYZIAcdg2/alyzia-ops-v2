import test from "node:test";
import assert from "node:assert/strict";
import {guardedFetch,isFlightStatsUrl} from "./fs-guard.js";
import {flightStatsReset,flightStatsPaused,flightStatsNoteResult} from "./ops-public-live-flow-optimized.js";
import {fetchEtd} from "./etd-public-flow.js";
test("les lectures de pages FlightStats passent par le disjoncteur commun",async()=>{
  flightStatsReset();
  assert.equal(isFlightStatsUrl("https://www.flightstats.com/v2/flight-tracker/AF/1"),true);
  assert.equal(isFlightStatsUrl("https://www.flightaware.com/live/flight/AFR1"),false);
  const calls=[];const f=async u=>{calls.push(String(u));return new Response("x",{status:403})};
  // autre site : appel direct, le disjoncteur n'est pas touché
  await guardedFetch("https://www.kayak.com/tracker/AF1",{},f);await guardedFetch("https://www.kayak.com/tracker/AF1",{},f);
  assert.equal(flightStatsPaused(),false);
  // deux refus FlightStats : pause commune
  await guardedFetch("https://www.flightstats.com/v2/flight-tracker/AF/1",{},f);
  await guardedFetch("https://www.flightstats.com/v2/flight-tracker/AF/2",{},f);
  assert.equal(flightStatsPaused(),true);
  const before=calls.length;
  const r=await guardedFetch("https://www.flightstats.com/v2/flight-tracker/AF/3",{},f);
  assert.equal(r.status,429);assert.equal(calls.length,before);              // aucune requête envoyée pendant la pause
  flightStatsReset();
});
test("ETD : un 403 FlightStats n'entraîne pas l'essai des autres écritures du numéro",async()=>{
  flightStatsReset();
  const old=globalThis.fetch,urls=[];
  globalThis.fetch=async u=>{urls.push(String(u));return new Response("403 Forbidden",{status:403})};
  try{
    await fetchEtd({designator:"TK1834",airline:"TK",number:"1834",date:"2026-10-09",origin:"CDG",destination:"IST",std:"12:00"});
    const fs=urls.filter(u=>u.includes("flightstats.com"));
    assert.ok(fs.length<=1,`FlightStats appelé ${fs.length} fois : ${fs.join(" ")}`);
  }finally{globalThis.fetch=old;flightStatsReset()}
});
