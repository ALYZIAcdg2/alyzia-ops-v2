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
