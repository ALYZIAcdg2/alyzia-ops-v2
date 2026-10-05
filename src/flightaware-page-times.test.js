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

test("the occurrence of the page is read, not the first other-day occurrence of the log (SQ337)",()=>{
  const day=(sched,est,act)=>`"takeoffTimes":{"scheduled":${sched},"estimated":${est},"actual":null},"landingTimes":{"scheduled":${sched},"estimated":${est},"actual":null},"gateDepartureTimes":{"scheduled":${sched},"estimated":${est},"actual":${act}},"gateArrivalTimes":{"scheduled":${sched},"estimated":${est},"actual":null}`;
  const html=`<script>var trackpollBootstrap = {"version":"2.24","flights":{"SIA337-1:0":{"activityLog":{"flights":[{"flightId":"next",${day(1791366000,1791366000,"null")}},{"flightId":"past",${day(1791060300,1791060300,1791060300)}}]},"takeoffTimes":{"scheduled":1791146700,"estimated":1791154680,"actual":1791154680},"landingTimes":{"scheduled":1791197040,"estimated":1791198180,"actual":null},"gateDepartureTimes":{"scheduled":1791146100,"estimated":1791152880,"actual":null},"gateArrivalTimes":{"scheduled":1791193200,"estimated":1791198780,"actual":null},"flightStatus":"airborne"}}};</script>`;
  const r=flightAwareJsonSemantic(html,{origin:"CDG",destination:"SIN"});
  assert.equal(r.eta,"19:13");
  assert.equal(r.takeoff,"00:58");
  assert.equal(r.ata,"");
});
