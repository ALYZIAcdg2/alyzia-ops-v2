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
