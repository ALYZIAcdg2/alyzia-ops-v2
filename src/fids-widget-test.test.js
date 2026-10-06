import test from "node:test";
import assert from "node:assert/strict";
import {extractEndpoints,keysOf,runFidsWidgetTest} from "./fids-widget-test.js";
test("extrait les adresses de données du script",()=>{
  const e=extractEndpoints('fetch("https://fids.flightradar.live/api/v1/flights");x="/static/a.css";y=\'/api/list\'');
  assert.deepEqual(e,["https://fids.flightradar.live/api/v1/flights","/api/list"]);
});
test("forme JSON",()=>assert.deepEqual(keysOf({a:[{b:1}]}),{a:{array:1,item:{b:"number"}}}));
test("test complet avec réseau simulé",async()=>{
  const fetchImpl=async u=>String(u).includes(".js")
    ?new Response('fetch("/api/flights");var atd=1',{status:200})
    :new Response(JSON.stringify({data:[{flight:"AF1",atd:"10:00"}]}),{status:200,headers:{"content-type":"application/json"}});
  const r=await runFidsWidgetTest({fetchImpl});
  assert.equal(r.verdict,"JSON_TROUVE");assert.ok(r.fieldHints.includes("atd"));
});
test("page par vol testée quand un vol est demandé",async()=>{
  const fetchImpl=async u=>String(u).includes("flight-tracker")?new Response("<html>Departure actual 07:10</html>",{status:200}):String(u).includes(".js")?new Response('fetch("/api/flights")',{status:200}):new Response("[]",{status:404});
  const r=await runFidsWidgetTest({fetchImpl,flight:"lo334"});
  assert.equal(r.tracker[0].hasActual,true);assert.ok(r.tracker[0].url.endsWith("LO334/"));
});
test("page par vol complète : adresse avec origine, destination et date-heure",async()=>{
  const urls=[];
  const fetchImpl=async u=>{urls.push(String(u));return String(u).includes("/flight-status/LO334/")?new Response("<html>Flight Departure Times Scheduled 07:05 Actual 07:12</html>",{status:200}):String(u).includes(".js")?new Response("x",{status:200}):new Response("n",{status:404})};
  const r=await runFidsWidgetTest({fetchImpl,flight:"lo334",dest:"waw",std:"07:05",date:"2026-10-06"});
  assert.ok(urls.includes("https://fids.flightradar.live/flight-status/LO334/CDG/WAW/202610060705"));
  assert.equal(r.flightPage.httpStatus,200);assert.equal(r.flightPage.hasActual,true);
});
