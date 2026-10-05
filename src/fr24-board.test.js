import test from "node:test";import assert from "node:assert/strict";
import {boardLookup,getBoard,__reset} from "./fr24-board.js";
const NOW=Date.parse("2026-10-05T12:00:00Z"); // 14:00 Paris
const STD=Date.parse("2026-10-05T11:00:00Z")/1000; // 13:00 Paris
const page=(flights,more=false)=>`<div data-page="${JSON.stringify({props:{flights,meta:{hasMoreNextData:more,nextPage:2}}}).replace(/&/g,"&amp;").replace(/"/g,"&quot;")}"></div>`;
const row={flightNumber:"AF430",status:{name:"departed"},scheduledTime:STD,estimatedTime:STD+1500,endpoint:{iata:"SJO"},gate:"M24",aircraft:{registration:"F-GSPL",type:"B772"},flightId:"41fa9fad"};
const ok=()=>async()=>new Response(page([row]),{status:200});
const f={date:"2026-10-05",airline:"AF",number:"430",designator:"AF430",origin:"CDG",std:"13:00",raw:{}};
test("lit ATD, immat, type et id FR24",async()=>{__reset();const r=await boardLookup(f,{fetchImpl:ok(),nowMs:NOW});assert.equal(r.attempt.status,"OK");assert.deepEqual(r.semantic,{atd:"13:25",gate:"M24",reg:"F-GSPL",aircraft:"B772"});assert.equal(r.fr24Id,"41fa9fad")});
test("heure prévue différente : vol ignoré",async()=>{__reset();const r=await boardLookup({...f,std:"18:00"},{fetchImpl:ok(),nowMs:NOW});assert.equal(r.attempt.status,"NOT_TRACKED");assert.deepEqual(r.semantic,{})});
test("403 : pause 10 min sans nouvelle requête",async()=>{__reset();let n=0;const bad=async()=>{n++;return new Response("no",{status:403})};const a=await boardLookup(f,{fetchImpl:bad,nowMs:NOW});assert.equal(a.attempt.status,"BLOCKED");const b=await boardLookup(f,{fetchImpl:bad,nowMs:Date.now()});assert.equal(b.attempt.status,"COOLDOWN");assert.equal(n,1)});
test("cache : une seule lecture pour plusieurs vols",async()=>{__reset();let n=0;const g=async()=>{n++;return new Response(page([row]),{status:200})};await getBoard({fetchImpl:g,nowMs:NOW});await getBoard({fetchImpl:g,nowMs:NOW+60000});assert.equal(n,1)});
test("hors CDG : pas de lecture",async()=>{assert.equal(await boardLookup({...f,origin:"LHR"},{fetchImpl:ok()}),null)});
test("lit la porte du tableau",async()=>{__reset();const r=await boardLookup(f,{fetchImpl:ok(),nowMs:NOW});assert.equal(r.semantic.gate,"M24")});
test("vol pas encore parti : ETD au lieu d'ATD",async()=>{__reset();const est={...row,status:{name:"estimated"}};const r=await boardLookup(f,{fetchImpl:async()=>new Response(page([est]),{status:200}),nowMs:NOW});assert.equal(r.semantic.etd,"13:25");assert.equal(r.semantic.atd,undefined);assert.equal(r.semantic.gate,"M24");assert.equal(r.semantic.reg,"F-GSPL");assert.equal(r.semantic.aircraft,"B772")});
