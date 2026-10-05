import test from "node:test";import assert from "node:assert/strict";
import {backfillBoardGates} from "./fr24-board-backfill.js";
const STD=Date.parse("2026-10-05T11:00:00Z")/1000; // 13:00 Paris
const page=fl=>`<div data-page="${JSON.stringify({props:{flights:fl,meta:{hasMoreNextData:false}}}).replace(/&/g,"&amp;").replace(/"/g,"&quot;")}"></div>`;
const mk=(n,gate,std=STD)=>({flightNumber:n,status:{name:"departed"},scheduledTime:std,estimatedTime:std+600,gate,aircraft:{},flightId:"x"});
function env(rows){const writes=[];return {writes,OPS_DB:{prepare:q=>({bind:(...a)=>({all:async()=>({results:rows}),run:async()=>{writes.push(a)}}),})}}}
const row=(id,fn,x)=>({identity:id,flight_date:"2026-10-05",flight_number:fn,airline:fn.slice(0,2),std:"13:00",data_json:JSON.stringify({airline:fn.slice(0,2),flight:fn,origin:"CDG",std:"13:00",...x})});
const fetchImpl=async()=>new Response(page([mk("AF430","M24"),mk("TU441","B12"),mk("TU441","B14",STD+3600)]),{status:200});
test("aperçu : trouve les portes sans écrire",async()=>{const e=env([row("1","AF430",{}),row("2","KL1",{})]);const r=await backfillBoardGates(e,{date:"2026-10-05",fetchImpl});assert.equal(r.withoutGate,2);assert.equal(r.filled,1);assert.equal(e.writes.length,0);assert.equal(r.sample[0].gate,"M24")});
test("apply : écrit la porte",async()=>{const e=env([row("1","AF430",{})]);const r=await backfillBoardGates(e,{date:"2026-10-05",apply:true,fetchImpl});assert.equal(r.written,true);assert.equal(e.writes.length,1);assert.match(e.writes[0][0],/"gate":"M24"/);assert.match(e.writes[0][0],/FR24BOARD/)});
test("porte déjà présente ou manuelle : ignorée",async()=>{const e=env([row("1","AF430",{gate:"A1"}),row("2","AF430",{gateSource:"MANUAL"})]);const r=await backfillBoardGates(e,{date:"2026-10-05",apply:true,fetchImpl});assert.equal(r.withoutGate,0);assert.equal(e.writes.length,0)});
test("même numéro deux fois : apparié par l'heure prévue",async()=>{const e=env([{...row("1","TU441",{}),std:"14:00",data_json:JSON.stringify({airline:"TU",flight:"TU441",origin:"CDG",std:"14:00"})}]);const r=await backfillBoardGates(e,{date:"2026-10-05",fetchImpl});assert.equal(r.sample[0].gate,"B14")});
test("porte « — » : comptée comme manquante et remplacée",async()=>{const e=env([row("1","AF430",{gate:"—"})]);const r=await backfillBoardGates(e,{date:"2026-10-05",apply:true,fetchImpl});assert.equal(r.withoutGate,1);assert.equal(r.filled,1);assert.match(e.writes[0][0],/"gate":"M24"/)});
