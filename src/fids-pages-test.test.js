import test from "node:test";
import assert from "node:assert/strict";
import {parsePageText,parseList,runFidsPages} from "./fids-pages-test.js";
test("lit les heures de la page par vol",()=>{
  const p=parsePageText("TK1826 CDG IST Active Departure: CDG Flight Departure Times October 06, 2026 Scheduled 16:10 Estimated 16:10 Actual 16:21 Terminal 1 Gate 24 Arrival: IST Flight Arrival Times Scheduled 20:45 Estimated 20:57");
  assert.equal(p.status,"Active");assert.equal(p.dep.scheduled,"16:10");assert.equal(p.dep.actual,"16:21");assert.equal(p.arr.estimated,"20:57");assert.equal(p.arr.actual,"");
});
test("liste vol:destination:STD",()=>{
  assert.deepEqual(parseList("ah1063:orn:20:00, bad ,JU243:BEG:20:35"),[{flight:"AH1063",dest:"ORN",std:"20:00"},{flight:"JU243",dest:"BEG",std:"20:35"}]);
});
test("compare la page par vol à la ligne du flux",async()=>{
  const feed=[{flight_iata:"AH1063",dep_time:"2026-10-06 20:00",dep_estimated:"2026-10-06 20:13",dep_actual:"",status:"active"}];
  const page="<html>Active Flight Departure Times Scheduled 20:00 Estimated 20:13 Actual 20:30 Flight Arrival Times Scheduled 21:30 Estimated 21:05</html>";
  const r=await runFidsPages({list:"AH1063:ORN:20:00,JU243:BEG:20:35",date:"2026-10-06",nowMs:Date.parse("2026-10-06T20:30:00Z"),fetchImpl:async u=>String(u).includes("schedules")?new Response(JSON.stringify(feed),{status:200}):String(u).includes("AH1063")?new Response(page,{status:200}):new Response("gone",{status:410})});
  assert.equal(r.rows[0].page.dep.actual,"20:30");assert.equal(r.rows[0].feed.dep_actual,"");assert.equal(r.rows[1].page.httpStatus,410);assert.equal(r.rows[1].feed,null);
});
