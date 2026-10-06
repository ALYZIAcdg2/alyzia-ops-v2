import test from "node:test";
import assert from "node:assert/strict";
import {plausibleAtd,indexFeed,pickFeedRow,sweepFidsToday} from "./fids-atd-sweep.js";
test("ATD plausible : pas futur, pas après décollage, pas trop avant STD",()=>{
  assert.equal(plausibleAtd("12:47",{std:"12:25",takeoff:"13:08",nowMin:840}),true);
  assert.equal(plausibleAtd("13:20",{std:"12:25",takeoff:"13:08",nowMin:840}),false);
  assert.equal(plausibleAtd("15:00",{std:"12:25",nowMin:840}),false);
  assert.equal(plausibleAtd("10:00",{std:"12:25",nowMin:840}),false);
});
test("ligne du flux : même vol et même STD, vol opérant d'abord",()=>{
  const rows=[{flight_iata:"UU8828",cs_flight_iata:"AF1828",dep_time:"2026-10-06 12:15"},{flight_iata:"AF1828",dep_time:"2026-10-06 12:15"},{flight_iata:"AF1828",dep_time:"2026-10-05 12:15"}];
  const i=indexFeed(rows,"2026-10-06");assert.equal(pickFeedRow(i,{designator:"AF1828",std:"12:15"}).flight_iata,"AF1828");assert.equal(pickFeedRow(i,{designator:"AF1828",std:"09:00"}),null);
});
function fakeDb(flights){const updates=[];return {updates,OPS_DB:{prepare:sql=>({bind:(...a)=>({all:async()=>({results:flights}),run:async()=>{updates.push(JSON.parse(a[0]))}})})}}}
test("écrit l'ATD manquant, respecte manuel et ATD déjà présent",async()=>{
  const mk=(n,d)=>({identity:n,flight_number:n.slice(2),airline:n.slice(0,2),std:"12:25",data_json:JSON.stringify({airline:n.slice(0,2),flight:n,std:"12:25",origin:"CDG",...d})});
  const env=fakeDb([mk("TK1832",{takeoff:"13:08"}),mk("AF1",{atd:"12:40",atdSource:"PUBLIC_LIVE:FLIGHTSTATS"}),mk("KL2",{atd:"12:30",atdSource:"MANUAL"})]);
  const rows=["TK1832","AF1","KL2"].map(f=>({flight_iata:f,dep_time:"2026-10-06 12:25",dep_actual:"2026-10-06 12:47"}));
  const nowMs=Date.parse("2026-10-06T12:30:00Z")+0; // 14:30 Paris
  const r=await sweepFidsToday(env,{nowMs,fetchImpl:async()=>new Response(JSON.stringify(rows),{status:200})});
  assert.equal(r.updated,1);assert.equal(env.updates[0].atd,"12:47");assert.equal(env.updates[0].atdSource,"PUBLIC_LIVE:FIDS");
});
import {fidsAttempt} from "./fids-atd-sweep.js";
test("tentative FIDS pour le bilan : lu, sans donnée, refusé",()=>{
  const ok={at:"x",status:"OK",http:200,flights:{"TK1832|12:25":"OK","AF1|12:25":"NO_USABLE_DATA"}};
  assert.equal(fidsAttempt(ok,"tk1832","12:25").status,"OK");
  assert.equal(fidsAttempt(ok,"AF1","12:25").status,"NO_USABLE_DATA");
  assert.equal(fidsAttempt(ok,"ZZ9","12:25").status,"NOT_TRACKED");
  const bad=fidsAttempt({status:"BLOCKED",http:403},"TK1832","12:25");
  assert.equal(bad.status,"BLOCKED");assert.equal(bad.httpStatus,403);
  assert.equal(fidsAttempt(null,"TK1832","12:25"),null);
});
import {plausibleActual} from "./fids-atd-sweep.js";
test("vol d'hier soir retardé : ATD d'aujourd'hui accepté, futur refusé",()=>{
  const now=Date.parse("2026-10-06T13:00:00Z");
  const row={dep_time_ts:Date.parse("2026-10-05T20:45:00Z")/1000,dep_actual_ts:Date.parse("2026-10-06T12:04:00Z")/1000,dep_actual:"2026-10-06 14:04"};
  assert.equal(plausibleActual(row,{std:"22:45",nowMs:now,sameDay:false}),true);
  assert.equal(plausibleActual({...row,dep_actual_ts:now/1000+7200},{std:"22:45",nowMs:now,sameDay:false}),false);
  assert.equal(plausibleActual({...row,dep_actual_ts:row.dep_time_ts+3*86400},{std:"22:45",nowMs:now,sameDay:false}),false);
});
import {onTimeAtd} from "./fids-atd-sweep.js";
test("parti à l'heure : ATD = STD seulement si le flux dit parti, estimé = prévu et décollage 5 à 35 min après",()=>{
  const row={status:"active",dep_time:"2026-10-06 16:10",dep_estimated:"2026-10-06 16:10",dep_actual:""};
  const ctx={std:"16:10",takeoff:"16:24",nowMin:1020,date:"2026-10-06"};
  assert.equal(onTimeAtd(row,ctx),"16:10");
  assert.equal(onTimeAtd({...row,dep_estimated:"2026-10-06 16:26"},ctx),"");
  assert.equal(onTimeAtd({...row,status:"scheduled"},ctx),"");
  assert.equal(onTimeAtd(row,{...ctx,takeoff:"16:55"}),"");
  assert.equal(onTimeAtd(row,{...ctx,takeoff:"16:12"}),"");
  assert.equal(onTimeAtd(row,{...ctx,takeoff:""}),"");
  assert.equal(onTimeAtd({...row,dep_actual:"2026-10-06 16:12"},ctx),"");
});
test("balayage : ATD parti à l'heure écrit avec sa source",async()=>{
  const e=fakeDb([{identity:"1",flight_number:"1826",airline:"TK",std:"16:10",data_json:JSON.stringify({airline:"TK",flight:"TK1826",std:"16:10",origin:"CDG",takeoff:"16:24"})}]);
  const rows=[{flight_iata:"TK1826",dep_time:"2026-10-06 16:10",dep_estimated:"2026-10-06 16:10",dep_actual:"",status:"active"}];
  const r=await sweepFidsToday(e,{nowMs:Date.parse("2026-10-06T14:40:00Z"),fetchImpl:async()=>new Response(JSON.stringify(rows),{status:200})});
  assert.equal(r.updated,1);assert.equal(e.updates[0].atd,"16:10");assert.equal(e.updates[0].atdSource,"PUBLIC_LIVE:FIDS_ONTIME");
});
import {classify} from "./admin-dashboard-native-wrapper.js";
test("ATD parti à l'heure contredit : vol À CONTRÔLER jusqu'à l'arrivée",()=>{
  const now={date:"2026-10-06",hhmm:"17:00"};
  const mk=x=>classify({row:{flight_date:"2026-10-06",flight_number:"1826",std:"16:10"},x:{airline:"TK",flight:"TK1826",std:"16:10",sta:"20:45",atd:"16:20",takeoff:"16:24",gate:"24",reg:"TC-A",atdSource:"PUBLIC_LIVE:FLIGHTSTATS",...x}},now);
  assert.equal(mk({atdConflict:{from:"16:10",to:"16:20"}}).state,"À CONTRÔLER");
  assert.ok(mk({atdConflict:{from:"16:10",to:"16:20"}}).missing.includes("ATD à vérifier"));
  assert.notEqual(mk({}).state,"À CONTRÔLER");
  assert.notEqual(mk({atdConflict:{from:"16:10",to:"16:20"},ata:"20:50"}).state,"À CONTRÔLER");
});
