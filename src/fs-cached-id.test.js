import test from "node:test";
import assert from "node:assert/strict";
import {flightStatsFromCachedId,flightStatsReset} from "./ops-public-live-flow-optimized.js";
const page="(MH) Malaysia Airlines 21 Flight Details On time | Departed Departure CDG Paris Charles de Gaulle Airport, FR Flight Gate Times 05-Oct-2026 Scheduled 11:20 CEST Actual 11:50 CEST Total Departure Delay: 30 mins Flight Runway Times 05-Oct-2026 Scheduled 11:45 CEST Actual 12:03 CEST Arrival KUL Kuala Lumpur Flight Gate Times 06-Oct-2026 Scheduled 06:10 UTC+08:00 Estimated 06:01 UTC+08:00 Flight Runway Times 06-Oct-2026 Scheduled 06:00 UTC+08:00 Estimated 05:55 UTC+08:00";
const f={airline:"MH",number:"21",date:"2026-10-05",designator:"MH21",raw:{flightStatsId:"123456",flightStatsIdDate:"2026-10-05"}};
test("id connu : API en 405 -> page flight-details lue directement, sans page de suivi",async()=>{
  flightStatsReset();const urls=[],real=globalThis.fetch;
  globalThis.fetch=async u=>{urls.push(String(u));if(String(u).includes("/api/"))return new Response("Method Not Allowed",{status:405});return new Response(page,{status:200})};
  try{
    const r=await flightStatsFromCachedId(f);
    assert.equal(r.status,"OK");assert.equal(r.semantic.atd,"11:50");assert.equal(r.semantic.takeoff,"12:03");assert.match(r.detailsInfo,/PAGE OK/);
    assert.ok(urls.some(u=>u.includes("/v2/flight-details/MH/21?year=2026&month=10&date=5&flightId=123456")));
    assert.ok(!urls.some(u=>u.includes("/flight-tracker/")));
    const before=urls.filter(u=>u.includes("/api/")).length;
    await flightStatsFromCachedId(f);
    assert.equal(urls.filter(u=>u.includes("/api/")).length,before); // l'API laissée de côté 6 h après un 405
  }finally{globalThis.fetch=real}
});
test("id d'un autre jour : rien (retour à la page de suivi)",async()=>{
  const r=await flightStatsFromCachedId({...f,raw:{flightStatsId:"1",flightStatsIdDate:"2026-10-04"}});assert.equal(r,null);
});
