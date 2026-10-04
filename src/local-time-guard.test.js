import test from "node:test";
import assert from "node:assert/strict";
import {guardDepartureClock,zoneOffsetMinutes} from "./local-time-guard.js";
import {auditFlightData} from "./admin-data-audit.js";

test("Paris offset follows summer / winter time",()=>{
  assert.equal(zoneOffsetMinutes("2026-10-04","Europe/Paris"),120);
  assert.equal(zoneOffsetMinutes("2026-12-04","Europe/Paris"),60);
});
test("a departure clock close to the STD is kept",()=>{
  assert.deepEqual(guardDepartureClock("05:37","05:00","2026-10-04"),{value:"05:37",status:"OK"});
  assert.deepEqual(guardDepartureClock("04:55","05:00","2026-10-04"),{value:"04:55",status:"OK"});
});
test("a UTC reading (STD 05:00 Paris, ATD read 03:37) is shifted to local",()=>{
  assert.deepEqual(guardDepartureClock("03:37","05:00","2026-10-04"),{value:"05:37",status:"SHIFTED"});
  assert.deepEqual(guardDepartureClock("03:37","05:00","2026-12-04"),{value:"04:37",status:"SHIFTED"}); // winter: UTC+1 -> 04:37 is still 23 min before STD, fine
});
test("an impossible departure is refused, no STD leaves the clock unchecked",()=>{
  assert.equal(guardDepartureClock("18:02","10:30","2026-10-04").status,"OK");
  assert.equal(guardDepartureClock("01:00","10:30","2026-10-04").status,"REJECTED");
  assert.equal(guardDepartureClock("05:37","","2026-10-04").status,"UNCHECKED");
});
test("midnight wrap is handled (STD 00:20, ATD read 22:40 UTC)",()=>{
  assert.deepEqual(guardDepartureClock("22:40","00:20","2026-10-04"),{value:"00:40",status:"SHIFTED"});
});

test("the audit reports and repairs a foreign date and a UTC clock, leaves a manual field alone",async()=>{
  const rows=[
    {identity:"2026-10-04|WB|WB700",flight_date:"2026-10-04",flight_number:"WB700",std:"10:30",data_json:JSON.stringify({flight:"WB700",std:"10:30",date:"2026-10-01",activeDate:"2026-10-01"})},
    {identity:"2026-10-04|ENT|ENT777",flight_date:"2026-10-04",flight_number:"ENT777",std:"05:00",data_json:JSON.stringify({flight:"ENT777",std:"05:00",date:"2026-10-04",atd:"03:37",atdSource:"PUBLIC_LIVE:FR24"})},
    {identity:"2026-10-04|XX|XX1",flight_date:"2026-10-04",flight_number:"XX1",std:"05:00",data_json:JSON.stringify({flight:"XX1",std:"05:00",date:"2026-10-04",atd:"03:37",atdSource:"MANUAL"})},
    {identity:"2026-10-04|OK|OK1",flight_date:"2026-10-04",flight_number:"OK1",std:"05:00",data_json:JSON.stringify({flight:"OK1",std:"05:00",date:"2026-10-04",atd:"05:10"})}
  ];
  const saved={};
  const env={OPS_DB:{prepare(sql){return {bind(...a){this.args=a;return this},async all(){return {results:rows}},async run(){if(sql.startsWith("UPDATE flights"))saved[this.args[1]]=JSON.parse(this.args[0]);return {}}}}}};
  const dry=await auditFlightData(env,{from:"2026-10-03",to:"2026-10-05",repair:false});
  assert.equal(dry.counts.DATE,2);assert.equal(dry.counts.UTC,2);assert.equal(Object.keys(saved).length,0);
  const fixed=await auditFlightData(env,{from:"2026-10-03",to:"2026-10-05",repair:true});
  assert.equal(fixed.repaired,2); // WB700 (dates) and ENT777 (UTC clock); the manual field is not repaired
  assert.equal(saved["2026-10-04|WB|WB700"].date,"2026-10-04");assert.equal(saved["2026-10-04|WB|WB700"].activeDate,"2026-10-04");
  assert.equal(saved["2026-10-04|ENT|ENT777"].atd,"05:37");
  assert.equal(saved["2026-10-04|XX|XX1"],undefined); // manual field: reported but not written
  assert.equal(saved["2026-10-04|OK|OK1"],undefined);
});
