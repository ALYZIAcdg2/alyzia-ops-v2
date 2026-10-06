import test from "node:test";import assert from "node:assert/strict";
import {loadRuntimeState,saveRuntimeState,__resetSaved} from "./runtime-state.js";
import {flightStatsNoteResult,flightStatsPaused,flightStatsReset} from "./ops-public-live-flow-optimized.js";
import {getBoard,__reset as resetBoard} from "./fr24-board.js";
function env(){const kv=new Map();return {kv,OPS_DB:{prepare:q=>({run:async()=>{},bind:(...a)=>({first:async()=>kv.has(a[0])?{v:kv.get(a[0])}:null,run:async()=>{if(/INSERT/.test(q))kv.set(a[0],a[1])}})})}}}
const NOW=Date.parse("2026-10-06T10:00:00Z"),STD=Date.parse("2026-10-06T09:00:00Z")/1000;
const page=fl=>`<div data-page="${JSON.stringify({props:{flights:fl,meta:{hasMoreNextData:false}}}).replace(/&/g,"&amp;").replace(/"/g,"&quot;")}"></div>`;
test("la pause FlightStats et le cache du tableau survivent à un nouveau passage",async()=>{
  const e=env();flightStatsReset();resetBoard();__resetSaved();
  const t=Date.now();flightStatsNoteResult(403,t);flightStatsNoteResult(403,t);
  let n=0;const f=async()=>{n++;return new Response(page([{flightNumber:"AF1",status:{name:"estimated"},scheduledTime:STD,estimatedTime:STD,gate:"A1",aircraft:{},flightId:"x"}]),{status:200})};
  await getBoard({fetchImpl:f,nowMs:NOW});assert.equal(n,1);
  assert.equal(await saveRuntimeState(e),true);assert.equal(await saveRuntimeState(e),false);   // inchangé : pas de réécriture
  // « nouvelle instance » : mémoire vide
  flightStatsReset();resetBoard();assert.equal(flightStatsPaused(t+1000),false);
  assert.equal(await loadRuntimeState(e),true);
  assert.equal(flightStatsPaused(t+1000),true);                                              // pause retrouvée
  const r=await getBoard({fetchImpl:f,nowMs:NOW+60000});assert.equal(n,1);assert.equal(r.status,"OK");   // cache retrouvé : aucune requête
  flightStatsReset();resetBoard();
});
test("base absente ou vide : aucun effet",async()=>{assert.equal(await loadRuntimeState({}),false);assert.equal(await loadRuntimeState(env()),false)});
