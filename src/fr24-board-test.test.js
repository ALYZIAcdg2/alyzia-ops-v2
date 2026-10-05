import test from "node:test";import assert from "node:assert/strict";
import {parseBoard,runFr24BoardTest,extractDataPage} from "./fr24-board-test.js";
const sample={props:{flights:[
 {flightNumber:"AA43",status:{name:"departed"},scheduledTime:100,estimatedTime:160,endpoint:{iata:"JFK"},gate:"A45",aircraft:{registration:"N781AN",type:"B772"},flightId:"41faa9d2",locked:{runway:true}},
 {flightNumber:"AF1",status:{name:"scheduled"},scheduledTime:200,estimatedTime:200,endpoint:{iata:"LHR"},aircraft:{}}],meta:{date:1,nextPage:2,hasMoreNextData:true,hoursRange:24}}};
test("parseBoard résume la page",()=>{const b=parseBoard(sample);assert.equal(b.total,2);assert.equal(b.withGate,1);assert.equal(b.departedWithTime,1);assert.equal(b.meta.nextPage,2);assert.equal(b.sample[0].fr24Id,"41faa9d2")});
test("verdict REFUSE sur 403",async()=>{const r=await runFr24BoardTest({fetchImpl:async()=>new Response("blocked",{status:403})});assert.equal(r.verdict,"REFUSE")});
test("verdict OK sur JSON valide",async()=>{const r=await runFr24BoardTest({fetchImpl:async()=>new Response(`<html><div id="app" data-page="${JSON.stringify(sample).replace(/&/g,"&amp;").replace(/"/g,"&quot;")}"></div></html>`,{status:200,headers:{"content-type":"text/html"}})});assert.equal(r.verdict,"OK");assert.equal(r.board.total,2)});
test("verdict challenge sur page HTML Cloudflare",async()=>{const r=await runFr24BoardTest({fetchImpl:async()=>new Response("<title>Just a moment...</title>",{status:200})});assert.equal(r.verdict,"CHALLENGE_CLOUDFLARE")});
test("extractDataPage décode les entités",()=>{assert.equal(extractDataPage('<div data-page="{&quot;a&quot;:&quot;x &amp; y&quot;}">').a,"x & y")});
