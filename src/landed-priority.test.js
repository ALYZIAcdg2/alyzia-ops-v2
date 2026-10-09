import test from "node:test";
import assert from "node:assert/strict";
import {sweepAtaFromLanding} from "./ata-derive-sweep.js";
import {arrivingSoon,priority} from "./ops-public-live-flow-optimized.js";
import {derive} from "./status-model-test.js";
function fakeDb(flights){const updates=[];return {updates,OPS_DB:{prepare:()=>({bind:(...a)=>({all:async()=>({results:flights}),run:async()=>{updates.push({data:JSON.parse(a[0]),id:a[1]})}})})}}}
const row=(id,airline,d)=>({identity:id,flight_date:"2026-10-09",airline,data_json:JSON.stringify({airline,flight:id,origin:"CDG",destination:"IST",dest:"IST",std:"07:20",...d})});
test("posé depuis 15 min ou plus sans ATA : ATA = LDG + 10 min, sans lecture ; manuel et ATA existante intacts",async()=>{
  const now=Date.parse("2026-10-09T09:53:00Z");                     // 12:53 à Istanbul
  const db=fakeDb([row("TK1830","TK",{landing:"11:32"}),row("TK1","TK",{landing:"12:45"}),row("TK2","TK",{landing:"11:00",ata:"11:12"}),row("TK3","TK",{landing:"11:00",ataSource:"MANUAL"}),row("TK4","TK",{})]);
  const r=await sweepAtaFromLanding(db,{nowMs:now});
  assert.equal(r.updated,1);
  assert.equal(db.updates[0].data.ata,"11:42");assert.equal(db.updates[0].data.ataSource,"PUBLIC_LIVE:DERIVED_LANDING_PLUS_10");
  assert.equal(db.updates[0].data.flightInfoLog[0].field,"ata");
});
test("ENT : l'ATA suit tout de suite l'atterrissage",async()=>{
  const db=fakeDb([row("ENT9ZW","ENT",{landing:"12:50"})]);
  const r=await sweepAtaFromLanding(db,{nowMs:Date.parse("2026-10-09T09:53:00Z")});
  assert.equal(r.updated,1);assert.equal(db.updates[0].data.ata,"13:00");
});
test("vol dont l'arrivée est dépassée (atterrissage manquant) : relu en priorité jusqu'à 2 h après",()=>{
  const now=Date.parse("2026-10-09T09:57:00Z");
  const x=m=>({statusArrivalUtc:new Date(now-m*60000).toISOString()});
  assert.equal(arrivingSoon(x(10),now),true);assert.equal(arrivingSoon(x(100),now),true);assert.equal(arrivingSoon(x(150),now),false);
  const f={std:"09:00",atd:"08:47",atdSource:"PUBLIC_LIVE:FIDS",takeoff:"08:58",...x(75),publicLiveBackfill:{checkedAt:new Date(now-70*60000).toISOString()}};
  assert.equal(priority({flight_date:"2026-10-09"},f,717,now)[0],0.1);   // ETA dépassée de plus de 15 min : rang 0,1 (avant les vols plus lointains)
  // ETA dépassée de moins de 15 min : reste au rang « arrivée proche » 0,5
  assert.equal(priority({flight_date:"2026-10-09"},{...f,...x(8)},717,now)[0],0.5);
});
test("ATD seulement estimée : n'occupe plus le rang des vols sans ATD ; sans ATD du tout : rang inchangé",()=>{
  const now=Date.parse("2026-10-09T09:57:00Z"),checked=new Date(now-20*60000).toISOString();
  const base={std:"09:00",takeoff:"08:58",publicLiveBackfill:{checkedAt:checked}};
  assert.ok(priority({flight_date:"2026-10-09"},{...base,atd:"08:50",atdSource:"PUBLIC_LIVE:FR24MOVE"},717,now)[0]>=0.5);
  assert.ok(priority({flight_date:"2026-10-09"},{...base,atd:"09:00",atdSource:"PUBLIC_LIVE:FIDS_ONTIME"},717,now)[0]>=0.5);
  assert.ok(priority({flight_date:"2026-10-09"},base,717,now)[0]<0.5);
});
test("ETA dépassée sans ATA : le statut reste EN VOL (plus d'ARRIVÉ par ETA + 15 min) et l'heure d'arrivée est conservée pour la priorité de lecture",()=>{
  const d=derive({std:"09:00",sta:"10:15",eta:"09:43",origin:"CDG",destination:"ALG",dest:"ALG",atd:"08:47",takeoff:"08:58"},"2026-10-09",Date.parse("2026-10-09T09:57:00Z"));
  assert.equal(d.status,"EN VOL");assert.equal(d.reason,"TAKEOFF");assert.ok(Number.isFinite(d.arrivalUtc));
});
