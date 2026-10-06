import test from "node:test";
import assert from "node:assert/strict";
import {summariseArrivals,runFidsArrivalsTest} from "./fids-arrivals-test.js";
test("résume un flux d'arrivées : lignes de CDG avec heure réelle",()=>{
  const rows=[{flight_iata:"AH1001",dep_iata:"CDG",dep_time:"2026-10-06 15:30",dep_actual:"2026-10-06 16:16",arr_time:"2026-10-06 17:40",arr_estimated:"2026-10-06 17:28",arr_actual:"2026-10-06 17:35",arr_gate:"A2",status:"landed"},
    {flight_iata:"TK1",dep_iata:"IST",arr_time:"2026-10-06 18:00",arr_actual:"",status:"active"}];
  const s=summariseArrivals(rows);
  assert.equal(s.rows,2);assert.equal(s.arrActual,1);assert.equal(s.fromCdg.rows,1);assert.equal(s.fromCdg.sample[0].arr_actual,"17:35");assert.equal(s.window.first,"2026-10-06 17:40");
});
test("lit les aéroports demandés et signale un refus",async()=>{
  const r=await runFidsArrivalsTest({iata:"alg,xx,IST",fetchImpl:async u=>String(u).endsWith("/ALG")?new Response(JSON.stringify([{dep_iata:"CDG",arr_actual:"2026-10-06 17:35"}]),{status:200}):new Response("no",{status:403})});
  assert.deepEqual(r.airports.map(a=>a.iata),["ALG","IST"]);assert.equal(r.airports[0].fromCdg.arrActual,1);assert.equal(r.airports[1].httpStatus,403);
});
