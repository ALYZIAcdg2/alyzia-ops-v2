import test from "node:test";
import assert from "node:assert/strict";
import {parseGatenavoFlights} from "./gatenavo-probe.js";
test("parse flights from escaped Next payload",()=>{
  const html='x{\\"id\\":\\"cdg-d-2026-10-06-af256\\",\\"gate\\":null,\\"status\\":\\"gate_closed\\",\\"terminal\\":\\"2E\\",\\"rawStatus\\":\\"Embarquement clos\\",\\"airlineCode\\":\\"AF\\",\\"flightNumber\\":\\"AF256\\",\\"estimatedTime\\":null,\\"scheduledTime\\":\\"2026-10-06T21:20:00.000Z\\"}y';
  const r=parseGatenavoFlights(html);assert.equal(r.length,1);assert.deepEqual(r[0],{id:"cdg-d-2026-10-06-af256",status:"gate_closed",raw:"Embarquement clos",flight:"AF256",scheduled:"2026-10-06T21:20:00.000Z"});
  assert.deepEqual(parseGatenavoFlights("rien"),[]);
});
