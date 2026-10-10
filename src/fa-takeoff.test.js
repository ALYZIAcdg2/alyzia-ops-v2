import test from "node:test";import assert from "node:assert/strict";
import {wantsFaTakeoff,decideFaTakeoff,applyFaTakeoff,runFaTakeoff} from "./fa-takeoff.js";
import {fetchFlightAwareLive} from "./ops-public-live-flow-optimized.js";
import {setFaTakeoffEnabled,flightAwareEnabled} from "./fa-policy.js";

const NOW=Date.parse("2026-10-10T10:44:00Z");   // 12:44 Paris
const tk={flight:"TK1830",airline:"TK",std:"07:20",origin:"CDG",destination:"IST",atd:"10:56",atdSource:"PUBLIC_LIVE:FIDS",status:"PARTI"};

test("wantsFaTakeoff : TK1830 (ATD réel FIDS depuis 108 min, pas de TO) est visé ; les autres cas sont exclus",()=>{
  assert.equal(wantsFaTakeoff(tk,NOW),true);
  assert.equal(wantsFaTakeoff({...tk,takeoff:"11:13"},NOW),false,"TO déjà là");
    assert.equal(wantsFaTakeoff({...tk,takeoff:"11:13",takeoffSource:"MANUAL"},NOW),false,"TO manuel");
  assert.equal(wantsFaTakeoff({...tk,atdSource:"PUBLIC_LIVE:FIDS_ONTIME"},NOW),false,"ATD estimée");
  assert.equal(wantsFaTakeoff({...tk,atdSource:"PUBLIC_LIVE:FR24MOVE"},NOW),false,"ATD estimée");
  assert.equal(wantsFaTakeoff({...tk,atd:""},NOW),false,"pas d'ATD");
  assert.equal(wantsFaTakeoff({...tk,landing:"13:00"},NOW),false,"déjà posé");
  assert.equal(wantsFaTakeoff({...tk,atd:"12:40"},NOW),false,"ATD de moins de 15 min");
  assert.equal(wantsFaTakeoff({...tk,atd:"05:00"},NOW),false,"ATD de plus de 6 h");
  assert.equal(wantsFaTakeoff({...tk,faTakeoffCheckedAt:new Date(NOW-5*60000).toISOString()},NOW),false,"lu il y a moins de 10 min");
  assert.equal(wantsFaTakeoff({...tk,faTakeoffCheckedAt:new Date(NOW-11*60000).toISOString()},NOW),true);
});
test("decideFaTakeoff : 0 à 90 min après l'ATD, jamais dans le futur",()=>{
  assert.deepEqual(decideFaTakeoff(tk,"11:13",NOW),{ok:true,value:"11:13"});
  assert.equal(decideFaTakeoff(tk,"10:50",NOW).ok,false,"avant la porte");
  assert.equal(decideFaTakeoff(tk,"12:30",NOW).ok,false,"plus de 90 min après la porte");
  assert.equal(decideFaTakeoff(tk,"12:59",NOW).ok,false,"dans le futur");
  assert.equal(decideFaTakeoff(tk,"",NOW).reason,"AUCUN_TO");
});
test("applyFaTakeoff : écrit le TO avec sa source et le journal, sans toucher à l'ATD",()=>{
  const n=applyFaTakeoff(tk,"11:13","2026-10-10T10:44:00.000Z");
  assert.equal(n.takeoff,"11:13");assert.equal(n.takeoffSource,"PUBLIC_LIVE:FLIGHTAWARE_TAKEOFF");assert.equal(n.atd,"10:56");
  assert.deepEqual(n.flightInfoLog[0],{at:"2026-10-10T10:44:00.000Z",source:"PUBLIC_LIVE:FLIGHTAWARE_TAKEOFF",field:"takeoff",from:"",to:"11:13"});
});

const epoch=(h,m)=>Date.UTC(2026,9,10,h,m)/1000;
const faPage=(takeoffUtc)=>`<html>"gateDepartureTimes":{"scheduled":${epoch(5,20)},"estimated":null,"actual":${takeoffUtc?epoch(9,13):"null"}} "takeoffTimes":{"scheduled":null,"estimated":null,"actual":${takeoffUtc?epoch(9,13):"null"}} "landingTimes":{"scheduled":null,"estimated":null,"actual":null} "gateArrivalTimes":{"scheduled":${epoch(9,0)},"estimated":${epoch(12,30)},"actual":null}</html>`;
function mkEnv(rows){const saved=[];
  const env={OPS_DB:{prepare(sql){return {bind(...a){this.a=a;return this},
    async all(){return {results:rows.map(x=>({identity:"id1",flight_date:"2026-10-10",flight_number:"TK1830",airline:"TK",std:"07:20",data_json:JSON.stringify(x)}))}},
    async first(){return {data_json:JSON.stringify(rows[0])}},
    async run(){if(sql.startsWith("UPDATE"))saved.push(JSON.parse(this.a[0]));return {}}}}}};
  return {env,saved};
}
function mockFa(takeoffUtc){const real=globalThis.fetch,urls=[];
  globalThis.fetch=async url=>{url=String(url);urls.push(url);
    if(url.includes("/history/"))return new Response(faPage(takeoffUtc),{status:200,headers:{"content-type":"text/html"}});
    return new Response('<a href="https://flightaware.com/live/flight/THY1830/history/20261010/0530Z/LFPG/LTFM">x</a>',{status:200,headers:{"content-type":"text/html"}})};
  return {urls,restore:()=>{globalThis.fetch=real}};
}
test("FlightAware reste arrêté pour tout le reste : sans usage étroit, aucune lecture",async()=>{
  assert.equal(flightAwareEnabled(),false);
  assert.equal(await fetchFlightAwareLive({airline:"TK",number:"1830",designator:"TK1830",origin:"CDG",destination:"IST",date:"2026-10-10",std:"07:20"},""),null);
});
test("runFaTakeoff : cas TK1830, FlightAware 11:13 → TO écrit (source FLIGHTAWARE_TAKEOFF), ATD intact, vol marqué lu",async()=>{
  const {env,saved}=mkEnv([tk]),m=mockFa(true);
  try{
    const r=await runFaTakeoff(env,{limit:1,nowMs:NOW});
    assert.equal(r.results[0].status,"TAKEOFF_WRITTEN");assert.equal(r.results[0].takeoff,"11:13");
    const w=saved.at(-1);assert.equal(w.takeoff,"11:13");assert.equal(w.takeoffSource,"PUBLIC_LIVE:FLIGHTAWARE_TAKEOFF");assert.equal(w.atd,"10:56");assert.equal(w.atdSource,"PUBLIC_LIVE:FIDS");
    assert.ok(w.faTakeoffCheckedAt);assert.match(w.flightAwareHistoryUrl,/LFPG\/LTFM/);
    assert.equal(m.urls.length,2,"2 requêtes au plus pour un vol (page de recherche puis page du vol)");
  }finally{m.restore()}
});
test("runFaTakeoff : FlightAware sans décollage réel → rien d'écrit pour le TO, mais le vol est marqué lu (nouvel essai dans 10 min)",async()=>{
  const {env,saved}=mkEnv([tk]),m=mockFa(false);
  try{
    const r=await runFaTakeoff(env,{limit:1,nowMs:NOW});
    assert.equal(r.results[0].status,"OK");assert.equal(r.results[0].reason,"AUCUN_TO");
    const w=saved.at(-1);assert.equal(w.takeoff,undefined);assert.ok(w.faTakeoffCheckedAt);
  }finally{m.restore()}
});
test("runFaTakeoff : interrupteur du TO arrêté → aucune lecture",async()=>{
  const {env,saved}=mkEnv([tk]),m=mockFa(true);setFaTakeoffEnabled(false);
  try{const r=await runFaTakeoff(env,{limit:1,nowMs:NOW});assert.equal(r.disabled,true);assert.equal(m.urls.length,0);assert.equal(saved.length,0)}
  finally{setFaTakeoffEnabled(true);m.restore()}
});
