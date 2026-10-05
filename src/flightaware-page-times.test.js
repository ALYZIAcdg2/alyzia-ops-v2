import test from "node:test";
import assert from "node:assert/strict";
import {flightAwareJsonTimes,flightAwareJsonSemantic,flightAwareJsonHints} from "./flightaware-page-times.js";

const t=(h,m)=>Date.UTC(2026,9,4,h,m)/1000; // 04 Oct 2026, UTC
const page=`<html><script>var trackpollBootstrap={"flights":{"ENT777":{"gateDepartureTimes":{"scheduled":${t(3,0)},"estimated":null,"actual":${t(3,37)}},"takeoffTimes":{"scheduled":${t(3,10)},"estimated":null,"actual":${t(3,48)}},"landingTimes":{"scheduled":${t(5,15)},"estimated":null,"actual":${t(5,45)}},"gateArrivalTimes":{"scheduled":${t(5,25)},"estimated":null,"actual":${t(5,55)}}}}};</script><body>Suivi et historique des vols</body></html>`;

test("times are read from the page script whatever the page language",()=>{
  const x=flightAwareJsonTimes(page);
  assert.equal(x.atd.actual,t(3,37));assert.equal(x.takeoff.actual,t(3,48));assert.equal(x.landing.actual,t(5,45));assert.equal(x.arrival.actual,t(5,55));
});
test("departure facts are local to the origin, arrival facts to the destination",()=>{
  assert.deepEqual(flightAwareJsonSemantic(page,{origin:"CDG",destination:"TIA"}),{atd:"05:37",takeoff:"05:48",eta:"",landing:"07:45",ata:"07:55"});
});
test("an estimated arrival is used as ETA while there is no actual one; escaped JSON is understood",()=>{
  const flying=page.replace(/"gateArrivalTimes":\{[^}]*\}/,`"gateArrivalTimes":{"scheduled":${t(5,25)},"estimated":${t(5,31)},"actual":null}`).replace(/"/g,'\\"');
  const s=flightAwareJsonSemantic(flying,{origin:"CDG",destination:"TIA"});
  assert.equal(s.ata,"");assert.equal(s.eta,"07:31");assert.equal(s.atd,"05:37");
});
test("nothing is invented from a page without those keys",()=>{
  assert.deepEqual(flightAwareJsonSemantic("<html>nothing</html>",{origin:"CDG",destination:"TIA"}),{atd:"",takeoff:"",eta:"",landing:"",ata:""});
  assert.deepEqual(flightAwareJsonHints("<html></html>"),[]);
  assert.ok(flightAwareJsonHints(page).length>0);
});

test("an estimated arrival equal to the schedule is not used as ETA",()=>{
  const same=page.replace(/"gateArrivalTimes":\{[^}]*\}/,`"gateArrivalTimes":{"scheduled":${t(5,25)},"estimated":${t(5,25)},"actual":null}`);
  assert.equal(flightAwareJsonSemantic(same,{origin:"CDG",destination:"TIA"}).eta,"");
});
