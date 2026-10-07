import test from "node:test";
import assert from "node:assert/strict";
import {probeUrls,probeFlightStats} from "./flightstats-probe.js";
test("adresses : suivi seul sans flightId, 3 types avec",()=>{
  assert.deepEqual(Object.keys(probeUrls({airline:"TK",number:"1830",date:"2026-10-07"})),["tracker"]);
  const u=probeUrls({airline:"TK",number:"1830",date:"2026-10-07",flightId:"1412738715"});
  assert.equal(u.details,"https://www.flightstats.com/v2/flight-details/TK/1830?year=2026&month=10&date=7&flightId=1412738715");
  assert.equal(u.api,"https://www.flightstats.com/v2/api/extendedDetails/TK/1830/2026/10/7/1412738715");
});
test("sonde : statut de chaque type, sans pause réelle",async()=>{
  const calls=[];
  const fetchImpl=async url=>{calls.push(url);return {status:url.includes("/api/")?403:200,ok:!url.includes("/api/"),headers:{get:()=>"cloudflare"},text:async()=>url.includes("flight-tracker")?'<a href="/v2/flight-details/TK/1830?year=2026&month=10&date=7&flightId=1412738715">':"<html></html>"}};
  const r=await probeFlightStats({airline:"tk",number:"1830",date:"2026-10-07",flightId:"1412738715"},{fetchImpl,sleep:async()=>{}});
  assert.equal(calls.length,3);assert.equal(r.results.api.httpStatus,403);assert.equal(r.results.tracker.flightIdFound,"1412738715");assert.equal(r.results.details.httpStatus,200);
});
test("paramètres manquants refusés sans requête",async()=>{
  const r=await probeFlightStats({airline:"",number:"1",date:"2026-10-07"},{fetchImpl:async()=>{throw new Error("non")}});
  assert.equal(r.ok,false);
});
