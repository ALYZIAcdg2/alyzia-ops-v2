import test from "node:test";import assert from "node:assert/strict";
import {parseFaBoard,runFaBoardTest} from "./fa-board-test.js";
const row=(cls,id,t,d,dep)=>`<tr><td class="${cls}" style="text-align: left"> <span title="x"><a href="/live/flight/id/${id}-1791-airline-1p%3a0">${id}</a></span></td><td class="${cls}"><span><a href="/live/aircrafttype/${t}">${t}</a></span></td><td class="${cls}"><span class="hint"><span dir="ltr">X</span></span> <span dir="ltr">(<a href="/live/airport/${d}" itemprop="url">VLC / ${d}</a>)</span></td><td class="${cls}">${dep}&nbsp;<span class="tz">CEST</span></td><td class="${cls}">lun. 04:39PM&nbsp;<span class="tz">CEST</span></td><td class="${cls}"></td></tr>`;
const html=`<table>${row("smallrow1","HOP1420","E190","LEVC","lun. 02:57PM")}${row("smallrow2","AFR702","B77W","DIAP","lun. 02:49PM")}</table>`;
test("parseFaBoard lit ident, type, destination, départ",()=>{const r=parseFaBoard(html);assert.equal(r.length,2);assert.deepEqual([r[0].ident,r[0].type,r[0].dest,r[0].departure],["HOP1420","E190","LEVC","lun. 02:57PM CEST"])});
test("verdict OK",async()=>{const r=await runFaBoardTest({fetchImpl:async()=>new Response(html,{status:200})});assert.equal(r.verdict,"OK");assert.equal(r.total,2)});
test("verdict REFUSE sur 429",async()=>{const r=await runFaBoardTest({fetchImpl:async()=>new Response("x",{status:429})});assert.equal(r.verdict,"REFUSE")});
test("page sans vols",async()=>{const r=await runFaBoardTest({fetchImpl:async()=>new Response("<html>Access denied</html>",{status:200})});assert.equal(r.verdict,"CHALLENGE")});
