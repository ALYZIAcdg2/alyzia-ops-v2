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
test("appariement souple : l'unique ligne à ±15 min, jamais plusieurs ni une STD modifiée",()=>{
  const rows=[{flight_iata:"JU243",dep_time:"2026-10-06 20:35"},{flight_iata:"XX1",cs_flight_iata:"JU243",dep_time:"2026-10-06 20:35"},{flight_iata:"TU441",dep_time:"2026-10-06 08:00"},{flight_iata:"TU441",dep_time:"2026-10-06 08:10"}];
  const idx=indexFeed(rows,"2026-10-06");
  assert.equal(pickFeedRow(idx,{designator:"JU243",std:"20:30"}).flight_iata,"JU243");
  assert.equal(pickFeedRow(idx,{designator:"JU243",std:"20:30"},0),null);
  assert.equal(pickFeedRow(idx,{designator:"JU243",std:"19:00"}),null);
  assert.equal(pickFeedRow(idx,{designator:"TU441",std:"08:05"}),null);
  assert.equal(pickFeedRow(idx,{designator:"TU441",std:"08:10"}).dep_time,"2026-10-06 08:10");
});
import {ataFromRow} from "./fids-atd-sweep.js";
test("ATA du flux : plausible seulement (pas futur, durée, après l'atterrissage connu)",()=>{
  const now=Date.parse("2026-10-06T16:00:00Z");
  const dep=Date.parse("2026-10-06T12:00:00Z")/1000,row=(arrMin,extra={})=>({arr_actual:"2026-10-06 17:45",arr_actual_ts:dep+arrMin*60,dep_actual_ts:dep,...extra});
  assert.equal(ataFromRow(row(120),{},now),"17:45");
  assert.equal(ataFromRow(row(10),{},now),"");            // arrivée 10 min après le départ : impossible
  assert.equal(ataFromRow({...row(120),arr_actual_ts:now/1000+3600},{},now),"");   // futur
  assert.equal(ataFromRow(row(120),{landing:"17:30"},now),"17:45");   // 15 min après l'atterrissage : porte
  assert.equal(ataFromRow(row(120),{landing:"17:44"},now),"");        // égale à l'atterrissage : piste
  assert.equal(ataFromRow(row(120),{landing:"16:30"},now),"");        // trop loin de l'atterrissage
  assert.equal(ataFromRow({...row(120),arr_actual:""},{},now),"");
});
test("balayage : ATA du flux écrit, provisoire, sans écraser FlightStats ni une saisie manuelle",async()=>{
  const nowMs=Date.parse("2026-10-06T16:00:00Z"),dep=Date.parse("2026-10-06T12:00:00Z")/1000;
  const mkRow=(n,d)=>({identity:n,flight_number:n.slice(2),airline:n.slice(0,2),std:"14:00",data_json:JSON.stringify({airline:n.slice(0,2),flight:n,std:"14:00",origin:"CDG",...d})});
  const e=fakeDb([mkRow("AH1",{}),mkRow("AH2",{ata:"19:50",ataSource:"PUBLIC_LIVE:FLIGHTSTATS"}),mkRow("AH3",{ata:"19:40",ataSource:"MANUAL"})]);
  const rows=["AH1","AH2","AH3"].map(f=>({flight_iata:f,dep_time:"2026-10-06 14:00",dep_actual:"2026-10-06 14:05",dep_actual_ts:dep,dep_time_ts:dep,arr_actual:"2026-10-06 17:45",arr_actual_ts:dep+120*60}));
  const r=await sweepFidsToday(e,{nowMs,fetchImpl:async()=>new Response(JSON.stringify(rows),{status:200})});
  const ata=e.updates.map(u=>[u.flight,u.ata,u.ataSource]).filter(x=>x[1]);
  assert.equal(r.ataUpdated,1);assert.deepEqual(ata.find(x=>x[0]==="AH1"),["AH1","17:45","PUBLIC_LIVE:FIDS"]);
  assert.ok(!ata.some(x=>x[0]==="AH2"&&x[2]==="PUBLIC_LIVE:FIDS"));assert.ok(!ata.some(x=>x[0]==="AH3"&&x[2]==="PUBLIC_LIVE:FIDS"));
});

import {etaFromRow} from "./fids-atd-sweep.js";
test("ETA du flux : tout vol pas posé accepté (parti ou non) ; posé ou incohérent refusé",()=>{
  const now=Date.parse("2026-10-07T11:00:00Z")/1000*1000,dep=now/1000-3600;
  const row={arr_estimated:"2026-10-07 13:30",arr_estimated_ts:now/1000+1800,dep_actual:"2026-10-07 12:11",dep_actual_ts:dep};
  assert.equal(etaFromRow(row,{atd:"12:11"},now),"13:30");
  assert.equal(etaFromRow(row,{atd:"12:11",ata:"13:25"},now),"");
  assert.equal(etaFromRow({...row,dep_actual:"",dep_actual_ts:0,dep_time_ts:now/1000+600},{},now),"13:30");
  assert.equal(etaFromRow({...row,arr_estimated_ts:dep+60},{atd:"12:11"},now),"");
  assert.equal(etaFromRow({...row,arr_estimated:""},{atd:"12:11"},now),"");
});
test("ETA FIDS remplace une ETA FlightAware (écart d'1 h), jamais manuelle ni FlightStats",async()=>{
  const mk=(n,d)=>({identity:n,flight_number:n.slice(2),airline:n.slice(0,2),std:"12:50",data_json:JSON.stringify({airline:n.slice(0,2),flight:n,std:"12:50",origin:"CDG",atd:"14:00",atdSource:"PUBLIC_LIVE:FIDS",...d})});
  const env=fakeDb([mk("AH1535",{eta:"14:05",etaSource:"PUBLIC_LIVE:FLIGHTAWAREEXACT"}),mk("TK1824",{eta:"14:05",etaSource:"PUBLIC_LIVE:FLIGHTSTATS"}),mk("LY222",{eta:"14:05",etaSource:"MANUAL"})]);
  const now=Date.parse("2026-10-07T11:55:00Z");
  const rows=["AH1535","TK1824","LY222"].map(f=>({flight_iata:f,dep_time:"2026-10-07 12:50",dep_actual:"2026-10-07 14:00",dep_actual_ts:now/1000-600,arr_estimated:"2026-10-07 15:11",arr_estimated_ts:now/1000+5000}));
  await sweepFidsToday(env,{nowMs:now,fetchImpl:async()=>new Response(JSON.stringify(rows),{status:200})});
  assert.equal(env.updates.length,1);assert.equal(env.updates[0].flight,"AH1535");assert.equal(env.updates[0].eta,"15:11");assert.equal(env.updates[0].etaSource,"PUBLIC_LIVE:FIDS");
});

import {etdFromRow} from "./fids-atd-sweep.js";
test("etdFromRow : ETD FIDS d'un vol pas encore parti",()=>{
  const row={dep_time:"2026-10-07 18:00",dep_estimated:"2026-10-07 18:30",dep_time_ts:1000000,dep_estimated_ts:1000000+1800};
  assert.equal(etdFromRow(row,{},{std:"18:00",date:"2026-10-07"}),"18:30");
  assert.equal(etdFromRow(row,{atd:"18:20"},{std:"18:00",date:"2026-10-07"}),"");            // déjà parti
  assert.equal(etdFromRow({...row,dep_estimated:"2026-10-08 00:30"},{},{std:"18:00",date:"2026-10-07"}),""); // autre jour
  assert.equal(etdFromRow({...row,dep_estimated_ts:1000000-7200},{},{std:"18:00",date:"2026-10-07"}),"");   // 2 h avant l'horaire programmé
  assert.equal(etdFromRow({...row,dep_estimated:"2026-10-07 18:00",dep_estimated_ts:1000000},{},{std:"18:00",date:"2026-10-07"}),""); // = STD, pas d'ETD chez nous
  assert.equal(etdFromRow({...row,dep_estimated:"2026-10-07 18:00",dep_estimated_ts:1000000},{etd:"18:43"},{std:"18:00",date:"2026-10-07"}),"18:00"); // FIDS dit à l'heure : on suit
});
