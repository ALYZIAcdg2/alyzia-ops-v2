import test,{beforeEach,afterEach,mock} from "node:test";
import assert from "node:assert/strict";
import {runFsRepair,runPublicLiveFlow,needsFsRepair,needsLiveRead,priority,fr24FirstRepair} from "./ops-public-live-flow-optimized.js";

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

test("la relecture normale ne change pas : un vol complet n'est pas relu par les lectures par vol (la réparation a sa propre étape)",()=>{
  const x={atd:"05:10",takeoff:"05:20",ata:"07:55",ataSource:"PUBLIC_LIVE:FIDS",std:"05:00"};
  assert.equal(needsLiveRead(today,today,x),false);
  assert.ok(priority({flight_date:today,std:"05:00"},x,720)[0]>=2);
});

const page=(runway,gate)=>`<html><body>CDG Paris Flight Gate Times 09-Oct-2026 Scheduled 05:00 CEST Actual 05:10 CEST Flight Runway Times 09-Oct-2026 Scheduled -- Actual 05:20 CEST Terminal 2D Arrival TIA Tirana Flight Gate Times 09-Oct-2026 Scheduled 07:25 CEST Actual ${gate} CEST Flight Runway Times 09-Oct-2026 Scheduled -- Actual ${runway} CEST Terminal - Tail Number ZA-ABC Flight Time Actual 2h 23m VIEW FLIGHT STATUS Event Timeline Time Date UTC CEST Event Data Updated 9 Oct 20:14 Estimated Runway Arrival changed Actual 09:59 Actual 09:58</body></html>`;

async function run(flight){
  let update=null;
  const env={OPS_DB:{prepare(sql){return {bind(json){if(sql.startsWith("UPDATE flights"))update=JSON.parse(json);return this},
    async all(){return {results:[{identity:"id1",flight_date:today,flight_number:"E4777",airline:"E4",std:"05:00",data_json:JSON.stringify(flight)}]}},
    async first(){return sql.includes("SELECT data_json")?{data_json:JSON.stringify(flight)}:null},
    async run(){return {}}}},batch:async()=>[]}};
  const r=await runFsRepair(env,{limit:3,nowMs:Date.now()});
  run.last=r;return update;
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
    const u=await run({...flightBase,ata:"07:55",ataSource:"PUBLIC_LIVE:FIDS",ldgFr24Tries:1});
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

test("étape fs-repair : 3 vols au plus par passage, les plus anciennement lus d'abord, un vol lu il y a moins de 4 min attend",async()=>{
  const restore=mockFs("07:48","07:55");
  const mk=(n,checked)=>({identity:"id"+n,flight_date:today,flight_number:"E477"+n,airline:"E4",std:"05:00",data_json:JSON.stringify({...flightBase,flight:"E477"+n,flightStatsId:"12345"+n,ata:"07:55",ataSource:"PUBLIC_LIVE:FIDS",publicLiveBackfill:{checkedAt:checked}})});
  const rows=[mk(1,"2026-01-01T00:00:00Z"),mk(2,"2026-01-02T00:00:00Z"),mk(3,"2026-01-03T00:00:00Z"),mk(4,"2026-01-04T00:00:00Z"),mk(5,new Date().toISOString())];
  const env={OPS_DB:{prepare(sql){return {bind(){return this},async all(){return {results:rows}},async first(){return null},async run(){return {}}}}}};
  try{
    const r=await runFsRepair(env,{limit:3});
    assert.equal(r.pending,4,"le vol lu à l'instant n'est pas candidat");
    assert.equal(r.checked,3);
  }finally{restore()}
});

test("relecture FlightStats : ATA manuelle jamais touchée",async()=>{
  const restore=mockFs("07:48","07:55");
  try{
    const u=await run({...flightBase,ata:"08:00",ataSource:"MANUAL"});
    assert.equal(u,null,"vol manuel : aucune relecture, rien d'écrit");
  }finally{restore()}
});


function mkEnv(rows){const saved=[],store=rows.map(x=>JSON.stringify(x));
  const env={OPS_DB:{prepare(sql){return {bind(...a){this.a=a;return this},
    async all(){return {results:store.map((d,i)=>({identity:"id"+i,flight_date:today,flight_number:"E4777",airline:"E4",std:"05:00",data_json:d}))}},
    async first(){return {data_json:store[0]}},
    async run(){if(sql.startsWith("UPDATE")){store[0]=this.a[0];saved.push(JSON.parse(this.a[0]))}return {}}}}}};
  return {env,saved};
}
// --- ATA réelle (FIDS) mais LDG manquant : FR24 d'abord, FlightStats seulement ensuite ---
const [yy,mm,dd]=today.split("-"),mon=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(mm)-1];
const history=`<html><tr><td>ZA-ABC</td><td>${dd} ${mon} ${yy}</td><td>2:08</td><td>Landed 07:48</td><td>STD 05:00</td><td>ATD 05:20</td><td>STA 07:25</td><td>FROM Paris (CDG)</td><td>TO Tirana (TIA)</td></tr></html>`;
function mockFr24(withLanding){const real=globalThis.fetch,urls=[];
  globalThis.fetch=async url=>{url=String(url);urls.push(url);
    if(url.includes("/data/flights/e4777"))return new Response(withLanding?history:"<html></html>",{status:200,headers:{"content-type":"text/html"}});
    return new Response("<html></html>",{status:200,headers:{"content-type":"text/html"}})};
  return {urls,restore:()=>{globalThis.fetch=real}};
}
const ldgFlight={...flightBase,ata:"07:55",ataSource:"PUBLIC_LIVE:FIDS"};
test("fr24FirstRepair : ATA FIDS réelle + LDG vide, jamais tenté → FR24 d'abord ; ATA calculée / FlightStats / déjà tenté → non",()=>{
  assert.equal(fr24FirstRepair(ldgFlight),true);
  assert.equal(fr24FirstRepair({...ldgFlight,ldgFr24Tries:1}),false);
  assert.equal(fr24FirstRepair({...ldgFlight,ataSource:"PUBLIC_LIVE:DERIVED_LANDING_PLUS_10"}),false);
  assert.equal(fr24FirstRepair({...ldgFlight,ataSource:"PUBLIC_LIVE:FLIGHTSTATS"}),false);
  assert.equal(fr24FirstRepair({...ldgFlight,landing:"07:48",takeoff:"05:20"}),false,"rien ne manque");
  assert.equal(needsFsRepair({...ldgFlight,landing:"07:48",takeoff:""}),true,"TO manquant : à réparer aussi");
});
test("LDG manquant, FR24 le donne : écrit depuis FR24, FlightStats jamais appelé, ATA FIDS intacte",async()=>{
  const {env,saved}=mkEnv([ldgFlight]),m=mockFr24(true);
  try{
    await runFsRepair(env,{limit:3,nowMs:Date.now()});
    const w=saved.at(-1);
    assert.equal(w.landing,"07:48");assert.equal(w.landingSource,"PUBLIC_LIVE:FR24");
    assert.equal(w.ata,"07:55");assert.equal(w.ataSource,"PUBLIC_LIVE:FIDS");assert.equal(w.atd,"05:10");
    assert.ok(!m.urls.some(u=>/flightstats/i.test(u)),"FlightStats non appelé : "+m.urls.join(" | "));
  }finally{m.restore()}
});
test("LDG manquant, FR24 n'a rien : FlightStats non appelé à la 1re lecture, ldgFr24Tries=1 (FlightStats à la suivante)",async()=>{
  const {env,saved}=mkEnv([ldgFlight]),m=mockFr24(false);
  try{
    await runFsRepair(env,{limit:3,nowMs:Date.now()});
    assert.ok(!m.urls.some(u=>/flightstats/i.test(u)),"FlightStats non appelé : "+m.urls.join(" | "));
    const w=saved.at(-1);assert.equal(w.ldgFr24Tries,1);assert.ok(!w.landing);assert.equal(w.ata,"07:55");
  }finally{m.restore()}
});
