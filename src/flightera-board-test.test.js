import test from "node:test";import assert from "node:assert/strict";
import {analyseFlighteraPage,runFlighteraBoardTest} from "./flightera-board-test.js";
const rows=Array.from({length:12},(_,i)=>`<tr><td>AF${100+i}</td><td>JFK</td><td>Décollé 10:0${i%10}</td></tr>`).join("");
const html=`<table><tbody>${rows}</tbody></table>`;
test("analyse : lignes, codes de vol, première ligne",()=>{const a=analyseFlighteraPage(html);assert.equal(a.trCount,12);assert.equal(a.distinctFlightCodes,12);assert.match(a.firstRowText,/AF100/);assert.equal(a.hints.table,true)});
test("verdict OK",async()=>{const r=await runFlighteraBoardTest({date:"2026-10-06",fetchImpl:async()=>new Response(html,{status:200})});assert.equal(r.verdict,"OK");assert.match(r.url,/2026-10-06%2000_00$/)});
test("verdict REFUSE et CHALLENGE",async()=>{assert.equal((await runFlighteraBoardTest({fetchImpl:async()=>new Response("x",{status:403})})).verdict,"REFUSE");assert.equal((await runFlighteraBoardTest({fetchImpl:async()=>new Response("<html>Just a moment...</html>",{status:200})})).verdict,"CHALLENGE")});
