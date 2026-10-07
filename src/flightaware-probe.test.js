import test from "node:test";
import assert from "node:assert/strict";
import {summarizeFlightAware,probeFlightAware} from "./flightaware-probe.js";
const now=Date.parse("2026-10-07T04:00:00Z");
test("résumé : statuts, 429, jamais lus, valeurs apportées",()=>{
  const r=summarizeFlightAware([
    {flightAwareHistoryUrl:"u",publicLiveBackfill:{attempts:[{source:"FLIGHTAWARE",status:"HTTP_429",httpStatus:429,checkedAt:"2026-10-07T03:40:00Z"}]}},
    {atdSource:"PUBLIC_LIVE:FLIGHTAWARE"},
    {publicLiveBackfill:{attempts:[{source:"FLIGHTAWARE",status:"COOLDOWN",checkedAt:"2026-10-07T01:00:00Z"}]}}
  ],{nowMs:now});
  assert.equal(r.flights,3);assert.equal(r.withHistoryUrl,1);assert.equal(r.neverRead,1);assert.equal(r.limited429,1);assert.equal(r.readThisHour,1);assert.equal(r.atdFromFA,1);assert.equal(r.lastStatus["HTTP_429 429"],1);
});
test("sonde : refus 429 de la page du vol, pas de seconde requête",async()=>{
  let n=0;const fetchImpl=async()=>{n++;return {status:429,headers:{get:k=>k==="retry-after"?"600":null},text:async()=>"Too Many Requests"}};
  const r=await probeFlightAware({designator:"thy1830",date:"2026-10-07",std:"07:20"},{fetchImpl,sleep:async()=>{}});
  assert.equal(n,1);assert.equal(r.results.landing.httpStatus,429);assert.equal(r.results.landing.retryAfter,"600");assert.equal(r.results.historyUrlFound,null);
});
test("sonde : paramètres manquants",async()=>{assert.equal((await probeFlightAware({designator:"",date:"x",std:""})).ok,false)});
