import test from "node:test";import assert from "node:assert/strict";
import {sweepBoardToday} from "./fr24-board-sweep.js";
import {__reset} from "./fr24-board.js";
const NOW=Date.parse("2026-10-05T14:00:00Z"),STD=Date.parse("2026-10-05T11:00:00Z")/1000; // 13:00 Paris
const page=fl=>`<div data-page="${JSON.stringify({props:{flights:fl,meta:{hasMoreNextData:false}}}).replace(/&/g,"&amp;").replace(/"/g,"&quot;")}"></div>`;
const mk=(o={})=>({flightNumber:"AF430",status:{name:"departed"},scheduledTime:STD,estimatedTime:STD+1500,gate:"M24",aircraft:{registration:"F-GSPL",type:"B772"},flightId:"x",...o});
function env(rows){const writes=[];return {writes,OPS_DB:{prepare:q=>({bind:(...a)=>({all:async()=>({results:rows}),run:async()=>{writes.push(a)}})})}}}
const row=x=>({identity:"1",flight_date:"2026-10-05",flight_number:"AF430",airline:"AF",std:"13:00",data_json:JSON.stringify({airline:"AF",flight:"AF430",origin:"CDG",std:"13:00",...x})});
const fetchOf=fl=>async()=>new Response(page(fl),{status:200});
test("porte, immat, type et décollage mis à jour même si le vol a déjà un ATD",async()=>{__reset();const e=env([row({atd:"13:10",atdSource:"PUBLIC_LIVE:FLIGHTSTATS",gate:"—",reg:"D-AIHV",aircraftActual:"320",aircraft:"320"})]);const r=await sweepBoardToday(e,{nowMs:NOW,fetchImpl:fetchOf([mk()])});const s=JSON.parse(e.writes[0][0]);assert.equal(s.gate,"M24");assert.equal(s.reg,"F-GSPL");assert.equal(s.aircraftActual,"772");assert.equal(s.takeoff,"13:25");assert.equal(s.atd,"13:10");assert.equal(r.updated,1)});
test("ATD écrit par le tableau : retiré",async()=>{__reset();const e=env([row({atd:"13:25",atdSource:"PUBLIC_LIVE:FR24BOARD",gate:"M24",reg:"F-GSPL",aircraftActual:"772",takeoff:"13:25",takeoffSource:"PUBLIC_LIVE:FR24BOARD"})]);const r=await sweepBoardToday(e,{nowMs:NOW,fetchImpl:fetchOf([mk()])});const s=JSON.parse(e.writes[0][0]);assert.equal(s.atd,undefined);assert.equal(r.counts.atdRemoved,1)});
test("saisie manuelle jamais touchée",async()=>{__reset();const e=env([row({gate:"A1",gateSource:"MANUAL",reg:"F-HPNA",regSource:"MANUAL",aircraftActual:"772",aircraftActualSource:"MANUAL",takeoff:"13:20",takeoffSource:"MANUAL"})]);await sweepBoardToday(e,{nowMs:NOW,fetchImpl:fetchOf([mk()])});assert.equal(e.writes.length,0)});
test("rien ne change : aucune écriture",async()=>{__reset();const e=env([row({gate:"M24",reg:"F-GSPL",aircraftActual:"772",takeoff:"13:25",takeoffSource:"PUBLIC_LIVE:FR24BOARD"})]);const r=await sweepBoardToday(e,{nowMs:NOW,fetchImpl:fetchOf([mk()])});assert.equal(e.writes.length,0);assert.equal(r.updated,0)});
test("vol pas encore parti : ETD",async()=>{__reset();const e=env([row({gate:"M24",reg:"F-GSPL",aircraftActual:"772"})]);await sweepBoardToday(e,{nowMs:NOW,fetchImpl:fetchOf([mk({status:{name:"estimated"}})])});const s=JSON.parse(e.writes[0][0]);assert.equal(s.etd,"13:25");assert.equal(s.takeoff,undefined)});
test("tableau en pause : rien lu",async()=>{__reset();const e=env([row({})]);const r=await sweepBoardToday(e,{nowMs:NOW,fetchImpl:async()=>new Response("x",{status:403})});assert.equal(r.checked,0);assert.equal(e.writes.length,0)});
test("ETD = STD écrit par le tableau : remet l'ancien ETD, ou le retire",async()=>{
  __reset();
  const mkLog=from=>[{at:"x",source:"PUBLIC_LIVE:FR24BOARD",field:"etd",from,to:"13:00"}];
  const base={gate:"M24",reg:"F-GSPL",aircraftActual:"772",takeoff:"13:25",takeoffSource:"PUBLIC_LIVE:FR24BOARD",etd:"13:00",etdSource:"PUBLIC_LIVE:FR24BOARD"};
  const e=env([row({...base,flightInfoLog:mkLog("13:16")})]);
  const r=await sweepBoardToday(e,{nowMs:NOW,fetchImpl:fetchOf([mk()])});
  const saved=JSON.parse(e.writes[0][0]);
  assert.equal(saved.etd,"13:16");assert.equal(saved.etdSource,"PUBLIC_LIVE:ETD_RESTORED");assert.equal(r.counts.etdRestored,1);
  __reset();
  const e2=env([row({...base,flightInfoLog:mkLog("")})]);
  await sweepBoardToday(e2,{nowMs:NOW,fetchImpl:fetchOf([mk()])});
  const s2=JSON.parse(e2.writes[0][0]);assert.equal(s2.etd,undefined);assert.equal(s2.etdSource,undefined);
});
