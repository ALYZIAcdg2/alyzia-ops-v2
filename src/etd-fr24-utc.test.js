import test from "node:test";
import assert from "node:assert/strict";
import {runEtdPublicFlow} from "./etd-public-flow.js";
import {zoneOffsetMinutes} from "./local-time-guard.js";

const today=new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

test("an ETD found in the text of an FR24 page (UTC) is stored as the local clock of the origin",async()=>{
  const flight={airline:"LO",flight:"LO336",std:"19:45",sta:"22:05",origin:"CDG",destination:"WAW",dest:"WAW"};
  let update=null;
  const env={OPS_DB:{prepare(sql){return {bind(json){if(sql.startsWith("UPDATE flights"))update=JSON.parse(json);return this},
    async all(){return {results:[{identity:"id1",flight_date:today,flight_number:"LO336",airline:"LO",std:"19:45",data_json:JSON.stringify(flight)}]}},
    async first(){return sql.includes("SELECT data_json")?{data_json:JSON.stringify(flight)}:null},
    async run(){return {}}}},batch:async()=>[]}};
  const real=globalThis.fetch;
  globalThis.fetch=async()=>new Response("<html>LO336 Warsaw WAW Estimated departure 17:50 Scheduled 17:45 Registration SP-LVO</html>",{headers:{"content-type":"text/html"}});
  try{
    await runEtdPublicFlow(env,{concurrency:1});
    assert.ok(update,"the flight was saved");
    const offset=zoneOffsetMinutes(today,"Europe/Paris"),local=`${String(Math.floor((17*60+50+offset)/60)).padStart(2,"0")}:${String((17*60+50+offset)%60).padStart(2,"0")}`;
    assert.equal(update.etd,local);
    assert.equal(update.etdTimeBasis,"CDG_LOCAL");
    assert.equal(update.etdSource,"PUBLIC_ETD:FR24");
  }finally{globalThis.fetch=real}
});

test("a long delay read in UTC (ETD 19:20 UTC = 21:20 local, only 25 min before the STD) is still converted",async()=>{
  const flight={airline:"LO",flight:"LO336",std:"19:45",sta:"22:05",origin:"CDG",destination:"WAW",dest:"WAW"};
  let update=null;
  const env={OPS_DB:{prepare(sql){return {bind(json){if(sql.startsWith("UPDATE flights"))update=JSON.parse(json);return this},
    async all(){return {results:[{identity:"id1",flight_date:today,flight_number:"LO336",airline:"LO",std:"19:45",data_json:JSON.stringify(flight)}]}},
    async first(){return sql.includes("SELECT data_json")?{data_json:JSON.stringify(flight)}:null},
    async run(){return {}}}},batch:async()=>[]}};
  const real=globalThis.fetch;
  globalThis.fetch=async()=>new Response("<html>LO336 Warsaw WAW Estimated departure 19:20 Scheduled 17:45 Registration SP-LVO</html>",{headers:{"content-type":"text/html"}});
  try{
    await runEtdPublicFlow(env,{concurrency:1});
    const offset=zoneOffsetMinutes(today,"Europe/Paris"),t=19*60+20+offset;
    assert.equal(update.etd,`${String(Math.floor(t/60)%24).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`);
  }finally{globalThis.fetch=real}
});
