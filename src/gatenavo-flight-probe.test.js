import test from "node:test";
import assert from "node:assert/strict";
import {probeGatenavoFlight} from "./gatenavo-probe.js";
const row=(st,raw,ts)=>`{"id":"cdg-d-2026-10-08-sk566","status":"${st}","rawStatus":"${raw}","flightNumber":"SK566","scheduledTime":"2026-10-08T09:15:00.000Z","sourceFetchedAt":"${ts}"}`;
test("sonde page de vol : statut et fraîcheur des deux côtés", async () => {
  const realFetch=globalThis.fetch;
  globalThis.fetch=async u=>String(u).includes("/flights/")
    ?{status:200,headers:new Headers(),text:async()=>`<p>Updated 2 min ago</p>${row("gate_closed","Embarquement clos","2026-10-08T09:32:00.000Z")}`}
    :{status:200,headers:new Headers(),text:async()=>row("boarding","Embarquement en cours","2026-10-08T09:20:00.000Z")};
  try{
    const r=await probeGatenavoFlight({flight:"SK 566"});
    assert.equal(r.page.rows[0].status,"gate_closed");assert.match(r.page.updatedText,/Updated 2 min ago/);
    assert.equal(r.list.status,"boarding");assert.equal(r.url,"https://gatenavo.com/en/flights/sk566");
  }finally{globalThis.fetch=realFetch}
});
