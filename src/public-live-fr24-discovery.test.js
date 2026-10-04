import test from "node:test";
import assert from "node:assert/strict";
import {runPublicLiveFlow} from "./ops-public-live-flow-optimized.js";

const today=new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const noon=Date.UTC(+today.slice(0,4),+today.slice(5,7)-1,+today.slice(8,10),12,0)/1000;
const playback={result:{response:{data:{flight:{
  identification:{number:{default:"E4777"},callsign:"ENT777"},
  time:{scheduled:{departure:noon,arrival:noon+8700},estimated:{departure:noon,arrival:noon+8700},real:{departure:noon+600,arrival:null}},
  status:{generic:{status:{text:"Departed"}}},
  airport:{origin:{code:{iata:"CDG"}},destination:{code:{iata:"TIA"}}},
  aircraft:{model:{code:"B738"},registration:"SP-ENX"},track:[]
}}}}};

test("live flow discovers the FR24 occurrence of ENT777, fills takeoff/status and keeps the id",async()=>{
  const flight={airline:"ENT",flight:"ENT777",std:"05:00",sta:"07:25",origin:"CDG",destination:"TIA",dest:"TIA"};
  let saved=null;
  const env={OPS_DB:{prepare(sql){return {bind(){return this},
    async all(){return {results:[{identity:"id1",flight_date:today,flight_number:"ENT777",airline:"ENT",std:"05:00",data_json:JSON.stringify(flight)}]}},
    async first(){return sql.includes("SELECT data_json")?{data_json:JSON.stringify(flight)}:null},
    async run(){if(sql.startsWith("UPDATE flights"))saved=true;return {}}}},batch:async()=>[]}};
  let update=null;
  const prepare=env.OPS_DB.prepare;
  env.OPS_DB.prepare=(sql)=>{const p=prepare(sql);if(sql.startsWith("UPDATE flights")){const bind=p.bind;p.bind=(json)=>{update=JSON.parse(json);return bind.call(p)}}return p};
  const real=globalThis.fetch;
  globalThis.fetch=async(url)=>{url=String(url);
    if(url.includes("/data/flights/e4777"))return new Response(`<html>${" x".repeat(200)} #41f60002 </html>`,{headers:{"content-type":"text/html"}});
    if(url.includes("flightId=41f60002"))return new Response(JSON.stringify(playback),{headers:{"content-type":"application/json"}});
    return new Response("<html></html>",{status:200,headers:{"content-type":"text/html"}})};
  try{
    const r=await runPublicLiveFlow(env,{limit:1,concurrency:1});
    assert.equal(r.ok,true);
    assert.ok(update,"the flight was saved");
    assert.equal(update.fr24OccurrenceId,"41f60002");
    assert.ok(update.takeoff);
    assert.equal(update.status,"EN VOL");
    assert.equal(update.reg,"SP-ENX");
  }finally{globalThis.fetch=real}
});
