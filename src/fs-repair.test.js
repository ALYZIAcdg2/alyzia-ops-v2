import test,{beforeEach,afterEach,mock} from "node:test";
import assert from "node:assert/strict";
import {runPublicLiveFlow,needsFsRepair,needsLiveRead,priority} from "./ops-public-live-flow-optimized.js";

const today=new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
beforeEach(()=>mock.timers.enable({apis:["Date"],now:Date.parse(today+"T10:00:00Z")}));
afterEach(()=>mock.timers.reset());

test("needsFsRepair : vols visés et vols exclus",()=>{
  const base={atd:"05:10",takeoff:"05:20"};
  assert.equal(needsFsRepair({...base,ata:"07:55",ataSource:"PUBLIC_LIVE:FIDS"}),true,"ATA réelle sans LDG");
  assert.equal(needsFsRepair({...base,ata:"07:55",ataSource:"PUBLIC_LIVE:FIDS",landing:"07:45",landingSource:"PUBLIC_LIVE:FR24"}),false,"complet avec LDG FR24");
  assert.equal(needsFsRepair({...base,ata:"07:55",ataSource:"PUBLIC_LIVE:DERIVED_LANDING_PLUS_10",landing:"07:45",landingSource:"PUBLIC_LIVE:FR24"}),true,"ATA calculée");
  assert.equal(needsFsRepair({...base,landing:"12:27",landingSource:"PUBLIC_LIVE:FLIGHTSTATS"}),true,"LDG FlightStats (TS189)");
  assert.equal(needsFsRepair({...base,ata:"07:55",ataSource:"PUBLIC_LIVE:FLIGHTSTATS",landing:"07:45",landingSource:"PUBLIC_LIVE:FR24"}),true,"ATA FlightStats");
  assert.equal(needsFsRepair({...base,ata:"07:55",ataSource:"PUBLIC_LIVE:FIDS",fsRepairAt:"2026-10-10T01:00:00Z"}),false,"une seule fois");
  assert.equal(needsFsRepair({...base,ata:"07:55",ataSource:"MANUAL"}),false,"ATA manuelle");
  assert.equal(needsFsRepair({ata:"07:55",ataSource:"PUBLIC_LIVE:FIDS"}),false,"vol non parti");
  assert.equal(needsFsRepair({...base}),false,"en vol, sans ATA");
});

test("un vol à réparer est relu (même « complet ») après les vols urgents, un vol réparé ne l'est plus",()=>{
  const x={atd:"05:10",takeoff:"05:20",ata:"07:55",ataSource:"PUBLIC_LIVE:FIDS",std:"05:00"};
  assert.equal(needsLiveRead(today,today,x),false,"un vol complet n'est pas relu par la lecture normale");
  assert.equal(priority({flight_date:today,std:"05:00"},x,720)[0],1.7);
  assert.equal(needsLiveRead(today,today,{...x,landing:"07:45",fsRepairAt:"x"}),false);
});

const page=(runway,gate)=>`<html><body>CDG Paris Flight Gate Times 09-Oct-2026 Scheduled 05:00 CEST Actual 05:10 CEST Flight Runway Times 09-Oct-2026 Scheduled -- Actual 05:20 CEST Terminal 2D Arrival TIA Tirana Flight Gate Times 09-Oct-2026 Scheduled 07:25 CEST Actual ${gate} CEST Flight Runway Times 09-Oct-2026 Scheduled -- Actual ${runway} CEST Terminal - Tail Number ZA-ABC Flight Time Actual 2h 23m VIEW FLIGHT STATUS Event Timeline Time Date UTC CEST Event Data Updated 9 Oct 20:14 Estimated Runway Arrival changed Actual 09:59 Actual 09:58</body></html>`;

async function run(flight){
  let update=null;
  const env={OPS_DB:{prepare(sql){return {bind(json){if(sql.startsWith("UPDATE flights"))update=JSON.parse(json);return this},
    async all(){return {results:[{identity:"id1",flight_date:today,flight_number:"E4777",airline:"E4",std:"05:00",data_json:JSON.stringify(flight)}]}},
    async first(){return sql.includes("SELECT data_json")?{data_json:JSON.stringify(flight)}:null},
    async run(){return {}}}},batch:async()=>[]}};
  await runPublicLiveFlow(env,{limit:1,concurrency:1});
  return update;
}
const flightBase={airline:"E4",flight:"E4777",std:"05:00",sta:"07:25",origin:"CDG",destination:"TIA",dest:"TIA",atd:"05:10",atdSource:"PUBLIC_LIVE:FIDS",takeoff:"05:20",takeoffSource:"PUBLIC_LIVE:FR24",flightStatsId:"123456",flightStatsIdDate:today,reg:"ZA-ABC",regSource:"FR24",aircraftActual:"B738"};
function mockFs(runway,gate){
  const real=globalThis.fetch;
  globalThis.fetch=async url=>{url=String(url);
    if(url.includes("extendedDetails"))return new Response("x",{status:405});
    if(url.includes("flight-details"))return new Response(page(runway,gate),{status:200,headers:{"content-type":"text/html"}});
    return new Response("<html></html>",{status:200,headers:{"content-type":"text/html"}})};
  return ()=>{globalThis.fetch=real};
}

test("relecture FlightStats : LDG manquant rempli avec la première valeur (runway), ATA FIDS et ATD inchangés",async()=>{
  const restore=mockFs("07:48","07:55");
  try{
    const u=await run({...flightBase,ata:"07:55",ataSource:"PUBLIC_LIVE:FIDS"});
    assert.ok(u,"enregistré");
    assert.equal(u.landing,"07:48");assert.equal(u.landingSource,"PUBLIC_LIVE:FLIGHTSTATS");
    assert.equal(u.ata,"07:55");assert.equal(u.ataSource,"PUBLIC_LIVE:FIDS");
    assert.equal(u.atd,"05:10");assert.equal(u.atdSource,"PUBLIC_LIVE:FIDS");
    assert.ok(u.fsRepairAt,"marqué : ne sera plus relu");
  }finally{restore()}
});

test("relecture FlightStats : ATA calculée remplacée par la vraie, LDG FR24 conservé",async()=>{
  const restore=mockFs("07:47","07:53");
  try{
    const u=await run({...flightBase,landing:"07:45",landingSource:"PUBLIC_LIVE:FR24",ata:"07:55",ataSource:"PUBLIC_LIVE:DERIVED_LANDING_PLUS_10"});
    assert.equal(u.landing,"07:45");assert.equal(u.landingSource,"PUBLIC_LIVE:FR24");
    assert.equal(u.ata,"07:53");assert.equal(u.ataSource,"PUBLIC_LIVE:FLIGHTSTATS");
    assert.ok(u.fsRepairAt);
  }finally{restore()}
});

test("relecture FlightStats : LDG faux d'origine FlightStats (heure de décollage) corrigé et ATA recalculée",async()=>{
  const restore=mockFs("07:48","07:55");
  try{
    const u=await run({...flightBase,landing:"05:20",landingSource:"PUBLIC_LIVE:FLIGHTSTATS",ata:"05:30",ataSource:"PUBLIC_LIVE:DERIVED_LANDING_PLUS_10"});
    assert.equal(u.landing,"07:48");assert.equal(u.ata,"07:55");assert.equal(u.ataSource,"PUBLIC_LIVE:FLIGHTSTATS");
  }finally{restore()}
});

test("relecture FlightStats : ATA manuelle jamais touchée",async()=>{
  const restore=mockFs("07:48","07:55");
  try{
    const u=await run({...flightBase,ata:"08:00",ataSource:"MANUAL"});
    assert.equal(u,null,"vol manuel : aucune relecture, rien d'écrit");
  }finally{restore()}
});
