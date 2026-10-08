import test from "node:test";
import assert from "node:assert/strict";
import {runPublicLiveFlow} from "./ops-public-live-flow-optimized.js";

const today=new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
// Les vols de test partent à 05:00 « aujourd'hui » avec un atterrissage à 07:45 : l'horloge est figée à 12:00 (Paris) pour que ces heures ne soient jamais dans le futur, quelle que soit l'heure d'exécution.
import {beforeEach,afterEach,mock} from "node:test";
beforeEach(()=>mock.timers.enable({apis:["Date"],now:Date.parse(today+"T10:00:00Z")}));
afterEach(()=>mock.timers.reset());
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

test("without playback, the FR24 history row alone gives ENT777 its ATD, landing, registration and derived ATA",async()=>{
  const flight={airline:"ENT",flight:"ENT777",std:"05:00",sta:"07:25",origin:"CDG",destination:"TIA",dest:"TIA"};
  let update=null;
  const env={OPS_DB:{prepare(sql){return {bind(json){if(sql.startsWith("UPDATE flights"))update=JSON.parse(json);return this},
    async all(){return {results:[{identity:"id1",flight_date:today,flight_number:"ENT777",airline:"ENT",std:"05:00",data_json:JSON.stringify(flight)}]}},
    async first(){return sql.includes("SELECT data_json")?{data_json:JSON.stringify(flight)}:null},
    async run(){return {}}}},batch:async()=>[]}};
  const [y,m,d]=today.split("-"),mon=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(m)-1];
  const history=`<html><tr><td>SP-ESB</td><td>${d} ${mon} ${y}</td><td>2:08</td><td>Landed 07:45</td><td>STD 05:00</td><td>ATD 05:37</td><td>STA 07:25</td><td>FROM Paris (CDG)</td><td>TO Tirana (TIA)</td></tr></html>`;
  const real=globalThis.fetch;
  globalThis.fetch=async(url)=>{url=String(url);
    if(url.includes("/data/flights/e4777"))return new Response(history,{headers:{"content-type":"text/html"}});
    return new Response("<html></html>",{status:200,headers:{"content-type":"text/html"}})};
  try{
    await runPublicLiveFlow(env,{limit:1,concurrency:1});
    assert.ok(update,"the flight was saved");
    assert.equal(update.takeoff,"05:37");
    assert.equal(update.landing,"07:45");
    assert.equal(update.reg,"SP-ESB");
    assert.equal(update.ata,"07:55");
    assert.equal(update.status,"ARRIVÉE");
  }finally{globalThis.fetch=real}
});

test("a UTC history page (as received by the Worker) is converted to local times before filling ENT777",async()=>{
  const flight={airline:"ENT",flight:"ENT777",std:"05:00",sta:"07:25",origin:"CDG",destination:"TIA",dest:"TIA"};
  let update=null;
  const env={OPS_DB:{prepare(sql){return {bind(json){if(sql.startsWith("UPDATE flights"))update=JSON.parse(json);return this},
    async all(){return {results:[{identity:"id1",flight_date:today,flight_number:"ENT777",airline:"ENT",std:"05:00",data_json:JSON.stringify(flight)}]}},
    async first(){return sql.includes("SELECT data_json")?{data_json:JSON.stringify(flight)}:null},
    async run(){return {}}}},batch:async()=>[]}};
  const [y,m,d]=today.split("-"),mon=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(m)-1];
  // 05:00 Paris = 03:00 UTC in summer time; the test only runs in the CEST period
  const offset=(new Date(Date.UTC(+y,+m-1,+d,12)).toLocaleString("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",hour12:false}))-12;
  if(offset!==2)return;
  const history=`<html><tr><td>SP-ESB</td><td>${d} ${mon} ${y}</td><td>Landed 05:45</td><td>STD 03:00</td><td>ATD 03:37</td><td>STA 05:25</td><td>FROM Paris (CDG)</td><td>TO Tirana (TIA)</td></tr></html>`;
  const real=globalThis.fetch;
  globalThis.fetch=async(url)=>String(url).includes("/data/flights/e4777")?new Response(history,{headers:{"content-type":"text/html"}}):new Response("<html></html>",{status:200,headers:{"content-type":"text/html"}});
  try{
    await runPublicLiveFlow(env,{limit:1,concurrency:1});
    assert.equal(update.takeoff,"05:37");
    assert.equal(update.landing,"07:45");
    assert.equal(update.ata,"07:55");
  }finally{globalThis.fetch=real}
});

test("a departure missed by more than 6 h without ATD is still picked before the later flights",async()=>{
  const nowMin=(()=>{const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).map(x=>[x.type,x.value]));return Number(p.hour)*60+Number(p.minute)})();
  if(nowMin<420||nowMin>1100)return; // minutes of the day only: needs a window with no midnight wrap
  const hm=m=>{const v=((m%1440)+1440)%1440;return String(Math.floor(v/60)).padStart(2,"0")+":"+String(v%60).padStart(2,"0")};
  const rows=[
    {identity:"late",flight_number:"LT1",airline:"LT",std:hm(nowMin+300)},
    {identity:"stale",flight_number:"ST1",airline:"ST",std:hm(nowMin-400)}
  ].map(r=>({...r,flight_date:today,data_json:JSON.stringify({airline:r.airline,flight:r.flight_number,std:r.std,origin:"CDG",destination:"TIA",dest:"TIA"})}));
  const seen=[];
  const env={OPS_DB:{prepare(sql){return {bind(){return this},async all(){return {results:rows}},async first(){return null},async run(){return {}}}},batch:async()=>[]}};
  const real=globalThis.fetch;
  globalThis.fetch=async(url)=>{seen.push(String(url));return new Response("<html></html>",{status:200,headers:{"content-type":"text/html"}})};
  try{
    const r=await runPublicLiveFlow(env,{limit:1,concurrency:1});
    assert.equal(r.results.length,1);
    assert.equal(r.results[0].flight,"ST1");
  }finally{globalThis.fetch=real}
});

test("a quarter of the slots is kept for stale departures when airborne flights outnumber the slots",async()=>{
  const nowMin=(()=>{const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).map(x=>[x.type,x.value]));return Number(p.hour)*60+Number(p.minute)})();
  if(nowMin<420||nowMin>1100)return;
  const hm=m=>String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
  const airborne=Array.from({length:6},(_,i)=>({identity:"air"+i,flight_number:"AB"+i,airline:"AB",std:hm(nowMin-120),extra:{atd:hm(nowMin-110),takeoff:hm(nowMin-105)}}));
  const stale={identity:"stale",flight_number:"ST1",airline:"ST",std:hm(nowMin-400),extra:{}};
  const rows=[...airborne,stale].map(r=>({identity:r.identity,flight_number:r.flight_number,airline:r.airline,std:r.std,flight_date:today,data_json:JSON.stringify({airline:r.airline,flight:r.flight_number,std:r.std,origin:"CDG",destination:"TIA",dest:"TIA",...r.extra})}));
  const env={OPS_DB:{prepare(){return {bind(){return this},async all(){return {results:rows}},async first(){return null},async run(){return {}}}},batch:async()=>[]}};
  const real=globalThis.fetch;
  globalThis.fetch=async()=>new Response("<html></html>",{status:200,headers:{"content-type":"text/html"}});
  try{
    const r=await runPublicLiveFlow(env,{limit:4,concurrency:1});
    assert.equal(r.results.length,4);
    assert.ok(r.results.some(x=>x.flight==="ST1"),"the stale departure gets one of the 4 slots");
  }finally{globalThis.fetch=real}
});

test("pickSlots keeps a quarter of the slots (at least one) for the second tier or later",async()=>{
  const {pickSlots}=await import("./ops-public-live-flow-optimized.js");
  const z=(id,tier)=>({id,p:[tier,0]});
  const sorted=[z("a1",1),z("a2",1),z("a3",1),z("a4",1),z("a5",1),z("a6",1),z("s1",2),z("s2",2),z("n1",4)];
  assert.deepEqual(pickSlots(sorted,4).map(x=>x.id),["a1","a2","a3","s1"]);
  assert.deepEqual(pickSlots(sorted,1).map(x=>x.id),["s1"]);
  assert.deepEqual(pickSlots(sorted,8).map(x=>x.id),["a1","a2","a3","a4","a5","a6","s1","s2"]);
  assert.deepEqual(pickSlots([z("a",1),z("b",1)],4).map(x=>x.id),["a","b"]);
});

test("FlightAware generic: the occurrence page is found from the landing page, its JSON times fill takeoff / landing, the URL is kept",async()=>{
  const {flightAwareHistoryUrl}=await import("./ops-public-live-flow-optimized.js");
  const [y,m,d]=today.split("-"),day=`${y}${m}${d}`;
  // a flight at 05:00 Paris = 03:00 UTC (summer); two occurrences listed: the day before and the day itself
  const page=`<a href="https://www.flightaware.com/live/flight/ENT777/history/${String(Number(day)-1)}/0310Z/LFPG/LATI">x</a><a href="https://www.flightaware.com/live/flight/ENT777/history/${day}/0310Z/LFPG/LATI">y</a><a href="https://www.flightaware.com/live/flight/ENT777/history/${day}/1810Z/LFPG/LATI">z</a>`;
  const offset=Number(new Date(Date.UTC(+y,+m-1,+d,12)).toLocaleString("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",hour12:false}))-12;
  const stdLocal=offset===2?"05:00":"04:00"; // 03:00 UTC in both cases
  assert.equal(flightAwareHistoryUrl(page,{date:today,std:stdLocal,origin:"CDG"}),`https://www.flightaware.com/live/flight/ENT777/history/${day}/0310Z/LFPG/LATI`);
  assert.equal(flightAwareHistoryUrl("<html>nothing</html>",{date:today,std:stdLocal,origin:"CDG"}),"");
});

test("live flow: FlightAware JSON gives ENT777 its ATD only (not takeoff / landing) when FR24 and FlightStats give nothing",async()=>{
  const flight={airline:"ENT",flight:"ENT777",std:"05:00",sta:"07:25",origin:"CDG",destination:"TIA",dest:"TIA"};
  let update=null;
  const env={OPS_DB:{prepare(sql){return {bind(json){if(sql.startsWith("UPDATE flights"))update=JSON.parse(json);return this},
    async all(){return {results:[{identity:"id1",flight_date:today,flight_number:"ENT777",airline:"ENT",std:"05:00",data_json:JSON.stringify(flight)}]}},
    async first(){return sql.includes("SELECT data_json")?{data_json:JSON.stringify(flight)}:null},
    async run(){return {}}}},batch:async()=>[]}};
  const [y,m,d]=today.split("-"),day=`${y}${m}${d}`;
  const at=(h,mi)=>Date.UTC(+y,+m-1,+d,h,mi)/1000;
  // the real FlightAware keys (from the deployed diagnostic), 05:38 / 07:45 local = 03:38 / 05:45 UTC in summer time
  const json=`"takeoffTimes":{"scheduled":${at(3,10)},"estimated":${at(3,38)},"actual":${at(3,38)}},"landingTimes":{"scheduled":${at(5,15)},"estimated":${at(5,45)},"actual":${at(5,45)}},"gateDepartureTimes":{"scheduled":${at(3,0)},"estimated":null,"actual":${at(3,20)}},"gateArrivalTimes":{"scheduled":${at(5,30)},"estimated":null,"actual":null}`;
  const offset=Number(new Date(Date.UTC(+y,+m-1,+d,12)).toLocaleString("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",hour12:false}))-12;
  if(offset!==2)return; // fixtures are written for summer time
  const real=globalThis.fetch;
  globalThis.fetch=async(url)=>{url=String(url);
    if(url.endsWith("/live/flight/ENT777"))return new Response(`<a href="https://www.flightaware.com/live/flight/ENT777/history/${day}/0310Z/LFPG/LATI">x</a>`,{headers:{"content-type":"text/html"}});
    if(url.includes(`/history/${day}/0310Z/LFPG/LATI`))return new Response(`<html><script>var d={${json}}</script></html>`,{headers:{"content-type":"text/html"}});
    return new Response("<html></html>",{status:200,headers:{"content-type":"text/html"}})};
  try{
    await runPublicLiveFlow(env,{limit:1,concurrency:1});
    assert.ok(update,"the flight was saved");
    assert.equal(update.atd,"05:20");            // heure de porte donnée par FlightAware
    assert.equal(update.takeoff,undefined);       // FlightAware ne sert qu'à l'ATD
    assert.equal(update.landing,undefined);
    assert.equal(update.flightAwareHistoryUrl,`https://www.flightaware.com/live/flight/ENT777/history/${day}/0310Z/LFPG/LATI`);
  }finally{globalThis.fetch=real}
});

test("runLiveForFlight: dry run shows what would be written for ENT777 without saving it; POST mode saves",async()=>{
  const {runLiveForFlight}=await import("./ops-public-live-flow-optimized.js");
  const flight={airline:"ENT",flight:"ENT777",std:"05:00",sta:"07:25",origin:"CDG",destination:"TIA",dest:"TIA"};
  let saved=0;
  const env={OPS_DB:{prepare(sql){return {bind(){return this},
    async all(){return {results:[{identity:"id1",flight_date:today,flight_number:"ENT777",airline:"ENT",std:"05:00",data_json:JSON.stringify(flight)}]}},
    async first(){return sql.includes("SELECT data_json")?{data_json:JSON.stringify(flight)}:null},
    async run(){if(sql.startsWith("UPDATE flights"))saved++;return {}}}},batch:async()=>[]}};
  const [y,m,d]=today.split("-"),mon=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(m)-1];
  const history=`<html><tr><td>SP-ESB</td><td>${d} ${mon} ${y}</td><td>Landed 07:45</td><td>STD 05:00</td><td>ATD 05:37</td><td>STA 07:25</td><td>FROM Paris (CDG)</td><td>TO Tirana (TIA)</td></tr></html>`;
  const real=globalThis.fetch;
  globalThis.fetch=async(url)=>String(url).includes("/data/flights/e4777")?new Response(history,{headers:{"content-type":"text/html"}}):new Response("<html></html>",{status:200,headers:{"content-type":"text/html"}});
  try{
    const dry=await runLiveForFlight(env,{flight:"ent777",dryRun:true});
    assert.equal(dry.ok,true);assert.equal(dry.candidates,1);assert.equal(dry.rank,1);assert.equal(dry.inNextRun,true);
    assert.equal(dry.result.dryRun,true);assert.equal(dry.result.after.takeoff,"05:37");assert.equal(dry.result.before.takeoff,null);assert.equal(dry.result.sources.FR24.takeoff,"05:37");
    assert.equal(saved,0,"a dry run saves nothing");
    const live=await runLiveForFlight(env,{flight:"ENT777",dryRun:false});
    assert.equal(live.result.status,"UPDATED");assert.equal(saved,1);
    assert.equal((await runLiveForFlight(env,{flight:"NOPE1",dryRun:true})).error,"FLIGHT_NOT_FOUND");
  }finally{globalThis.fetch=real}
});

test("flightAwareHistoryUrl / cleanFlightAwareUrl never return a share link that merely contains the URL",async()=>{
  const {flightAwareHistoryUrl}=await import("./ops-public-live-flow-optimized.js");
  const {cleanFlightAwareUrl}=await import("./flightaware-page-times.js");
  const real="https://www.flightaware.com/live/flight/ENT777/history/20261004/0310Z/LFPG/LATI";
  const page=`<a href="https://facebook.com/sharer.php?u=${real}">share</a><a href="https://twitter.com/intent/tweet?url=${real}">tweet</a>`;
  assert.equal(flightAwareHistoryUrl(page,{date:"2026-10-04",std:"05:00",origin:"CDG"}),real);
  assert.equal(cleanFlightAwareUrl(`https://facebook.com/sharer.php?u=${real}`),real);
  assert.equal(cleanFlightAwareUrl("https://example.com/x"),"");
  assert.equal(cleanFlightAwareUrl(""),"");
});

test("a web word that looks like a registration (E-MAIL) is not kept: the real registration of the page is, and an E-MAIL already stored is replaced",async()=>{
  const flight={airline:"ENT",flight:"ENT777",std:"05:00",sta:"07:25",origin:"CDG",destination:"TIA",dest:"TIA",reg:"E-MAIL",flightAwareHistoryUrl:"https://facebook.com/sharer.php?u=https://www.flightaware.com/live/flight/ENT777/history/20261004/0310Z/LFPG/LATI"};
  let update=null;
  const env={OPS_DB:{prepare(sql){return {bind(json){if(sql.startsWith("UPDATE flights"))update=JSON.parse(json);return this},
    async all(){return {results:[{identity:"id1",flight_date:today,flight_number:"ENT777",airline:"ENT",std:"05:00",data_json:JSON.stringify(flight)}]}},
    async first(){return sql.includes("SELECT data_json")?{data_json:JSON.stringify(flight)}:null},
    async run(){return {}}}},batch:async()=>[]}};
  const [y,m,d]=today.split("-"),mon=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(m)-1];
  const history=`<html><tr><td>SP-ESB</td><td>${d} ${mon} ${y}</td><td>Landed 07:45</td><td>STD 05:00</td><td>ATD 05:37</td><td>STA 07:25</td><td>FROM Paris (CDG)</td><td>TO Tirana (TIA)</td></tr></html>`;
  const real=globalThis.fetch;
  globalThis.fetch=async(url)=>String(url).includes("/data/flights/e4777")?new Response(history,{headers:{"content-type":"text/html"}}):new Response("<html>Contact E-MAIL us</html>",{status:200,headers:{"content-type":"text/html"}});
  try{
    await runPublicLiveFlow(env,{limit:1,concurrency:1});
    assert.equal(update.reg,"SP-ESB");
    assert.equal(update.takeoff,"05:37");
  }finally{globalThis.fetch=real}
});

test("live flow: vol JU arrivé sans ATD (JU241) : FlightAware donne l'ATD (heure de porte)",async()=>{
  const flight={airline:"JU",flight:"JU241",std:"07:00",sta:"09:25",origin:"CDG",destination:"BEG",dest:"BEG",takeoff:"07:49",landing:"09:50",ata:"10:00",reg:"YU-APU",aircraftActual:"320",aircraft:"320"};
  let update=null;
  const env={OPS_DB:{prepare(sql){return {bind(json){if(sql.startsWith("UPDATE flights"))update=JSON.parse(json);return this},
    async all(){return {results:[{identity:"id1",flight_date:today,flight_number:"JU241",airline:"JU",std:"07:00",data_json:JSON.stringify(flight)}]}},
    async first(){return sql.includes("SELECT data_json")?{data_json:JSON.stringify(flight)}:null},
    async run(){return {}}}},batch:async()=>[]}};
  const [y,m,d]=today.split("-"),day=`${y}${m}${d}`;
  const at=(h,mi)=>Date.UTC(+y,+m-1,+d,h,mi)/1000;
  const offset=Number(new Date(Date.UTC(+y,+m-1,+d,12)).toLocaleString("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",hour12:false}))-12;
  if(offset!==2)return; // fixtures are written for summer time
  // 07:30 locale = 05:30 UTC : départ de la porte réel donné par FlightAware
  const json=`"gateDepartureTimes":{"scheduled":${at(5,0)},"estimated":null,"actual":${at(5,30)}},"takeoffTimes":{"scheduled":${at(5,10)},"estimated":${at(5,49)},"actual":${at(5,49)}},"landingTimes":{"scheduled":${at(7,15)},"estimated":${at(7,50)},"actual":${at(7,50)}},"gateArrivalTimes":{"scheduled":${at(7,25)},"estimated":null,"actual":${at(8,0)}}`;
  const real=globalThis.fetch,asked=[];
  globalThis.fetch=async(url)=>{url=String(url);asked.push(url);
    if(/\/live\/flight\/(ASL|JU)241$/.test(url))return new Response(`<a href="https://www.flightaware.com/live/flight/ASL241/history/${day}/0500Z/LFPG/LYBE">x</a>`,{headers:{"content-type":"text/html"}});
    if(url.includes(`/history/${day}/0500Z/LFPG/LYBE`))return new Response(`<html><script>var d={${json}}</script></html>`,{headers:{"content-type":"text/html"}});
    return new Response("<html></html>",{status:200,headers:{"content-type":"text/html"}})};
  try{
    await runPublicLiveFlow(env,{limit:1,concurrency:1});
    assert.ok(asked.some(u=>/flightaware\.com/.test(u)),"FlightAware a été lu pour le vol JU");
    assert.ok(update,"le vol est enregistré");
    assert.equal(update.atd,"07:30");
  }finally{globalThis.fetch=real}
});

test("live flow: vol parti dont l'arrivée manque longtemps après l'heure prévue (AH1543) : FlightAware donne LDG et ATA, l'ATD du FIDS n'est pas touchée",async()=>{
  const flight={airline:"AH",flight:"AH1543",std:"07:00",sta:"09:25",origin:"CDG",destination:"ALG",dest:"ALG",duration:140,atd:"07:05",atdSource:"PUBLIC_LIVE:FIDS",takeoff:"07:49",reg:"LZ-FSG",aircraftActual:"320",aircraft:"320"};
  let update=null;
  const env={OPS_DB:{prepare(sql){return {bind(json){if(sql.startsWith("UPDATE flights"))update=JSON.parse(json);return this},
    async all(){return {results:[{identity:"id1",flight_date:today,flight_number:"AH1543",airline:"AH",std:"07:00",data_json:JSON.stringify(flight)}]}},
    async first(){return sql.includes("SELECT data_json")?{data_json:JSON.stringify(flight)}:null},
    async run(){return {}}}},batch:async()=>[]}};
  const [y,m,d]=today.split("-"),day=`${y}${m}${d}`;
  const at=(h,mi)=>Date.UTC(+y,+m-1,+d,h,mi)/1000;
  const offset=Number(new Date(Date.UTC(+y,+m-1,+d,12)).toLocaleString("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",hour12:false}))-12;
  if(offset!==2)return; // fixtures are written for summer time
  const json=`"gateDepartureTimes":{"scheduled":${at(5,0)},"estimated":null,"actual":${at(5,35)}},"takeoffTimes":{"scheduled":${at(5,10)},"estimated":${at(5,49)},"actual":${at(5,49)}},"landingTimes":{"scheduled":${at(7,15)},"estimated":${at(7,50)},"actual":${at(7,50)}},"gateArrivalTimes":{"scheduled":${at(7,25)},"estimated":null,"actual":${at(8,0)}}`;
  const real=globalThis.fetch;
  globalThis.fetch=async(url)=>{url=String(url);
    if(/\/live\/flight\/(DAH|AH)1543$/.test(url))return new Response(`<a href="https://www.flightaware.com/live/flight/DAH1543/history/${day}/0500Z/LFPG/DAAG">x</a>`,{headers:{"content-type":"text/html"}});
    if(url.includes(`/history/${day}/0500Z/LFPG/DAAG`))return new Response(`<html><script>var d={${json}}</script></html>`,{headers:{"content-type":"text/html"}});
    return new Response("<html></html>",{status:200,headers:{"content-type":"text/html"}})};
  try{
    await runPublicLiveFlow(env,{limit:1,concurrency:1});
    assert.ok(update,"le vol est enregistré");
    assert.equal(update.landing,"08:50");   // heure locale d'Alger (UTC+1)
    assert.equal(update.ata,"09:00");
    assert.equal(update.atd,"07:05");                       // l'ATD du FIDS reste
    assert.equal(update.atdSource,"PUBLIC_LIVE:FIDS");
  }finally{globalThis.fetch=real}
});
