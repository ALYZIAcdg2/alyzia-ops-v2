import test from "node:test";
import assert from "node:assert/strict";
import {farFromDeparture} from "./ops-public-live-flow-optimized.js";
// 2026-10-07 04:47 à Paris (UTC+2) = 02:47 UTC
const now=Date.parse("2026-10-07T02:47:00Z");
test("vol non parti à plus de 90 min : pas d'appel FlightStats / FlightAware",()=>{assert.equal(farFromDeparture("2026-10-07","07:20",{},now),true)});
test("vol à moins de 90 min : appel autorisé",()=>{assert.equal(farFromDeparture("2026-10-07","06:10",{},now),false);assert.equal(farFromDeparture("2026-10-07","06:17",{},now),false)});
test("limite : 90 min pile autorisées, 91 refusées",()=>{assert.equal(farFromDeparture("2026-10-07","06:17",{},now),false);assert.equal(farFromDeparture("2026-10-07","06:18",{},now),true)});
test("vol parti (ATD ou décollage) ou STD passée : toujours lu",()=>{assert.equal(farFromDeparture("2026-10-07","07:20",{atd:"07:30"},now),false);assert.equal(farFromDeparture("2026-10-07","07:20",{takeoff:"07:38"},now),false);assert.equal(farFromDeparture("2026-10-07","03:00",{},now),false)});
test("vol d'hier toujours lu, vol de demain jamais",()=>{assert.equal(farFromDeparture("2026-10-06","23:30",{},now),false);assert.equal(farFromDeparture("2026-10-08","06:00",{},now),true)});
test("STD absente : on ne bloque pas",()=>{assert.equal(farFromDeparture("2026-10-07","",{},now),false)});
