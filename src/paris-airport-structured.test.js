import test from "node:test";
import assert from "node:assert/strict";
import {parseParisRows,structuredIndex,hitFromRow} from "./paris-airport-status-flow.js";
const rows=[{displayFlightNumber:"AF7340",codeShares:[{displayFlightNumber:"AF7340"},{displayFlightNumber:"DL8407"}],departureIataCode:"CDG",departureDate:"2026-10-07",arrivalIataCode:"MRS",departureStatus:"boarding",departureStatusLabel:"Embarquement en cours"},
  {displayFlightNumber:"TO7048",codeShares:[],departureIataCode:"ORY",departureDate:"2026-10-07",arrivalIataCode:"PGF",departureStatus:"take_off",departureStatusLabel:"Décollé à 15:45",departureActualTime:"15:45"}];
test("parse RSC body",()=>{const b='0:{"a":"$@1"}\n1:'+JSON.stringify(rows)+'\n';assert.equal(parseParisRows(b).length,2);assert.deepEqual(parseParisRows("junk"),[])});
test("index CDG only, codeshares included",()=>{const i=structuredIndex(rows,"2026-10-07");assert.ok(i.has("AF7340|MRS"));assert.ok(i.has("DL8407|MRS"));assert.equal(i.size,2);assert.equal(structuredIndex(rows,"2026-10-08").size,0)});
test("status mapping",()=>{assert.equal(hitFromRow(rows[0]).phase,"EMBARQUEMENT");assert.equal(hitFromRow({departureStatus:"boarding_closed"}).phase,"EMBARQUEMENT CLOS");assert.equal(hitFromRow({departureStatus:"cancelled"}).phase,"ANNULÉ");assert.equal(hitFromRow(rows[1]).takeoff,"15:45");assert.equal(hitFromRow({departureStatus:"on_time"}).phase,"");assert.equal(hitFromRow({departureStatus:"delayed"}).phase,"")});
