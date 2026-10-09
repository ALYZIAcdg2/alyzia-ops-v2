import test from "node:test";
import assert from "node:assert/strict";
import {sweepFidsToday} from "./fids-atd-sweep.js";
import {sweepBoardToday} from "./fr24-board-sweep.js";
import {__reset} from "./fr24-board.js";
import fs from "node:fs";
function fakeDb(flights){const updates=[];return {updates,OPS_DB:{prepare:sql=>({bind:(...a)=>({all:async()=>({results:flights}),run:async()=>{updates.push(JSON.parse(a[0]))}})})}}}
const NOW=Date.parse("2026-10-06T08:00:00Z");   // 10:00 Paris
const mk=(d)=>({identity:"1",flight_date:"2026-10-06",flight_number:"AF430",airline:"AF",std:"13:00",data_json:JSON.stringify({airline:"AF",flight:"AF430",origin:"CDG",std:"13:00",gate:"M24",reg:"F-GSPL",aircraftActual:"772",...d})});
test("l'ETD écrit par le tableau FR24 n'est pas écrasé par le FIDS",async()=>{
  const row={flight_iata:"AF430",dep_time:"2026-10-06 13:00",dep_estimated:"2026-10-06 13:40"};
  const withBoard=fakeDb([mk({etd:"13:25",edt:"13:25",etdSource:"PUBLIC_LIVE:FR24BOARD"})]);
  await sweepFidsToday(withBoard,{nowMs:NOW,fetchImpl:async()=>new Response(JSON.stringify([row]),{status:200})});
  assert.equal(withBoard.updates.length,0);
  // sans ETD du tableau, le FIDS écrit comme avant
  const noBoard=fakeDb([mk({etd:"13:25",edt:"13:25",etdSource:"PUBLIC_ETD:FLIGHTSTATS"})]);
  await sweepFidsToday(noBoard,{nowMs:NOW,fetchImpl:async()=>new Response(JSON.stringify([row]),{status:200})});
  assert.equal(noBoard.updates[0]?.etd,"13:40");
});
const page=fl=>`<div data-page="${JSON.stringify({props:{flights:fl,meta:{hasMoreNextData:false}}}).replace(/&/g,"&amp;").replace(/"/g,"&quot;")}"></div>`;
test("le tableau FR24 CDG est la source de l'ETD : il remplace un ETD du FIDS, jamais une saisie manuelle",async()=>{
  const STD=Date.parse("2026-10-06T11:00:00Z")/1000;                 // 13:00 Paris
  const fl=[{flightNumber:"AF430",status:{name:"estimated"},scheduledTime:STD,estimatedTime:STD+1800,gate:"M24",aircraft:{registration:"F-GSPL",type:"B772"},flightId:"x"}];
  for(const [src,expected] of [["PUBLIC_LIVE:FIDS","13:30"],["PUBLIC_ETD:FLIGHTSTATS","13:30"],["MANUAL",undefined]]){
    __reset();
    const writes=[];const env={OPS_DB:{prepare:()=>({bind:(...a)=>({all:async()=>({results:[mk({etd:"13:40",edt:"13:40",etdSource:src})]}),run:async()=>{writes.push(JSON.parse(a[0]))}})})}};
    await sweepBoardToday(env,{nowMs:NOW,fetchImpl:async()=>new Response(page(fl),{status:200})});
    assert.equal(writes[0]?.etd,expected,src);
  }
});
test("les lectures publiques d'ETD ne remplacent pas celui du tableau",()=>{
  for(const f of ["etd-public-flow.js","etd-public-runner.js"]){
    const s=fs.readFileSync(new URL("./"+f,import.meta.url),"utf8");
    assert.match(s,/FIDS\|FR24BOARD/,f);
  }
});
