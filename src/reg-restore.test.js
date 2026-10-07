import test from "node:test";
import assert from "node:assert/strict";
import {lastBoardReg,planRestore} from "./reg-restore.js";
const log=(...e)=>e.map(([source,to],i)=>({at:"2026-10-07T1"+i+":00:00Z",source,field:"reg",from:"",to}));
const fl=(n,std,extra={})=>({flight_number:n,std,x:{origin:"CDG",std,...extra}});
test("dernière valeur du tableau FR24, jamais une autre source",()=>{
  const x={flightInfoLog:[...log(["REG_DUPLICATE",""],["FR24","D-AIHV"],["PUBLIC_LIVE:FR24BOARD","TF-ICR"],["FR24","LZ-XXX"])]};
  assert.equal(lastBoardReg(x).reg,"TF-ICR");
  assert.equal(lastBoardReg({flightInfoLog:log(["FR24","D-AIHV"])}),null);
});
test("restaure les vols sans immatriculation, refuse un doublon proche",()=>{
  const rows=[
    fl("FI547","17:15",{flightInfoLog:log(["PUBLIC_LIVE:FR24BOARD","TF-ICR"])}),
    fl("TK1834","18:05",{flightInfoLog:log(["PUBLIC_LIVE:FR24BOARD","TC-LSM"])}),
    fl("AH1","12:00",{reg:"LZ-FSA"}),                                  // déjà remplie : intacte
    fl("AH2","12:30",{flightInfoLog:log(["PUBLIC_LIVE:FR24BOARD","LZ-FSA"])}), // LZ-FSA déjà portée à 30 min : refusée
  ];
  const p=planRestore(rows);
  assert.deepEqual(p.restore.map(c=>c.r.flight_number).sort(),["FI547","TK1834"]);
  assert.deepEqual(p.skipped.map(s=>s.flight),["AH2"]);
});

import {planClear,isKnownBad,restoreRegs} from "./reg-restore.js";
test("D-AIHV isolée : nettoyée sauf si la source est le tableau FR24 ou une saisie manuelle",()=>{
  const rows=[
    {flight_number:"SQ335",std:"10:55",x:{origin:"CDG",reg:"D-AIHV",regSource:"FR24"}},
    {flight_number:"LH1",std:"14:00",x:{origin:"CDG",reg:"D-AIHV",regSource:"PUBLIC_LIVE:FR24BOARD"}},
    {flight_number:"LH2",std:"20:00",x:{origin:"CDG",reg:"d-aihv",regSource:"MANUAL"}},
    {flight_number:"AH1",std:"12:00",x:{origin:"CDG",reg:"LZ-FSA",regSource:"FR24"}},
  ];
  assert.equal(isKnownBad("D-AIHV"),true);assert.equal(isKnownBad("LZ-FSA"),false);
  assert.deepEqual(planClear(rows).map(r=>r.flight_number),["SQ335"]);
});
test("après nettoyage, le vol retrouve la valeur du tableau FR24 de son journal (jamais D-AIHV)",()=>{
  const log=(...e)=>e.map(([source,to],i)=>({at:"2026-10-07T1"+i+":00:00Z",source,field:"reg",from:"",to}));
  const r={flight_number:"SQ335",std:"10:55",x:{origin:"CDG",reg:"D-AIHV",regSource:"FR24",flightInfoLog:log(["PUBLIC_LIVE:FR24BOARD","D-AIHV"],["PUBLIC_LIVE:FR24BOARD","9V-SWM"])}};
  const p=planRestore([r],{clear:planClear([r])});
  assert.equal(p.restore.length,1);assert.equal(p.restore[0].reg,"9V-SWM");
});
test("restoreRegs en application : nettoie, restaure et journalise",async()=>{
  const row={identity:"i1",flight_number:"SQ335",std:"10:55",data_json:JSON.stringify({origin:"CDG",std:"10:55",reg:"D-AIHV",registration:"D-AIHV",regSource:"FR24",flightInfoLog:[{at:"x",source:"PUBLIC_LIVE:FR24BOARD",field:"reg",from:"",to:"9V-SWM"}]})};
  const writes=[];const env={OPS_DB:{prepare:sql=>({bind:(...a)=>({all:async()=>({results:[row]}),run:async()=>{writes.push(JSON.parse(a[0]));return {}}})})}};
  const dry=await restoreRegs(env,{date:"2026-10-07",dryRun:true});assert.equal(dry.toClear,1);assert.equal(dry.toRestore,1);assert.equal(writes.length,0);
  const out=await restoreRegs(env,{date:"2026-10-07",dryRun:false});assert.equal(out.cleared,1);assert.equal(out.restored,1);
  const last=writes[writes.length-1];assert.equal(last.reg,"9V-SWM");assert.equal(last.flightInfoLog[0].source,"REG_RESTORED");assert.equal(last.flightInfoLog[1].source,"REG_CLEARED_KNOWN_BAD");
});
