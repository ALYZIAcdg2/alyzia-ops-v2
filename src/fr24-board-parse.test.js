import test from "node:test";import assert from "node:assert/strict";
import {parseBoard,extractDataPage} from "./fr24-board-parse.js";
const sample={props:{flights:[
 {flightNumber:"AA43",status:{name:"departed"},scheduledTime:100,estimatedTime:160,endpoint:{iata:"JFK"},gate:"A45",aircraft:{registration:"N781AN",type:"B772"},flightId:"41faa9d2",locked:{runway:true}},
 {flightNumber:"AF1",status:{name:"scheduled"},scheduledTime:200,estimatedTime:200,endpoint:{iata:"LHR"},aircraft:{}}],meta:{date:1,nextPage:2,hasMoreNextData:true,hoursRange:24}}};
test("parseBoard résume la page",()=>{const b=parseBoard(sample);assert.equal(b.total,2);assert.equal(b.withGate,1);assert.equal(b.departedWithTime,1);assert.equal(b.meta.nextPage,2);assert.equal(b.sample[0].fr24Id,"41faa9d2")});
test("extractDataPage décode les entités",()=>{assert.equal(extractDataPage('<div data-page="{&quot;a&quot;:&quot;x &amp; y&quot;}">').a,"x & y")});
