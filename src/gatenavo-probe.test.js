import test from "node:test";
import assert from "node:assert/strict";
import {parseGatenavoFlights} from "./gatenavo-probe.js";
test("parse flights from escaped Next payload",()=>{
  const html='x{\\"id\\":\\"cdg-d-2026-10-06-af256\\",\\"gate\\":null,\\"status\\":\\"gate_closed\\",\\"terminal\\":\\"2E\\",\\"rawStatus\\":\\"Embarquement clos\\",\\"airlineCode\\":\\"AF\\",\\"flightNumber\\":\\"AF256\\",\\"estimatedTime\\":null,\\"scheduledTime\\":\\"2026-10-06T21:20:00.000Z\\"}y';
  const r=parseGatenavoFlights(html);assert.equal(r.length,1);assert.deepEqual(r[0],{id:"cdg-d-2026-10-06-af256",status:"gate_closed",raw:"Embarquement clos",flight:"AF256",scheduled:"2026-10-06T21:20:00.000Z",fetchedAt:""});
  assert.deepEqual(parseGatenavoFlights("rien"),[]);
});
import {gatenavoPhase} from "./gatenavo-probe.js";
test("phase mapping and fetchedAt",()=>{
  assert.equal(gatenavoPhase("boarding"),"EMBARQUEMENT");assert.equal(gatenavoPhase("gate_closed"),"EMBARQUEMENT CLOS");assert.equal(gatenavoPhase("cancelled"),"ANNULÉ");assert.equal(gatenavoPhase("delayed"),"");assert.equal(gatenavoPhase("scheduled"),"");
  const html='{\\"id\\":\\"cdg-d-x-af1\\",\\"status\\":\\"boarding\\",\\"rawStatus\\":\\"Embarquement en cours\\",\\"flightNumber\\":\\"AF1\\",\\"scheduledTime\\":\\"2026-10-07T13:20:00.000Z\\",\\"sourceFetchedAt\\":\\"2026-10-07T13:00:00.000Z\\"}';
  assert.equal(parseGatenavoFlights(html)[0].fetchedAt,"2026-10-07T13:00:00.000Z");
});
