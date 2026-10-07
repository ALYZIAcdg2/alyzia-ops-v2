import test from "node:test";
import assert from "node:assert/strict";
import {parseMvt,utcToLocal,flightDateFromDay,applyMvt,ingestMvt,sitadocAuthorized} from "./sitadoc-mvt.js";

test("MVT d'arrivée de la capture (LO334/06, SP-LVN, WAW, AA0718/0724)",()=>{
  const m=parseMvt("LO334/06.SPLVN.WAW\nAA0718/0724");
  assert.deepEqual([m.airline,m.number,m.day,m.reg,m.station,m.aa.land,m.aa.block],["LO","334",6,"SPLVN","WAW","0718","0724"]);
  assert.equal(utcToLocal("0718","2026-10-06","Europe/Warsaw"),"09:18");assert.equal(utcToLocal("0724","2026-10-06","Europe/Warsaw"),"09:24");
});
test("MVT de départ : calage retiré, décollage, ETA",()=>{
  const m=parseMvt("MVT\nTK1830/07.TCLTB.CDG\nAD0518/0531 EA0745 IST\nPX153");
  assert.deepEqual([m.station,m.ad.off,m.ad.air,m.ea],["CDG","0518","0531","0745"]);
});
test("messages sans heures ou sans ligne vol : ignorés",()=>{assert.equal(parseMvt("SOMETHING ELSE"),null);assert.equal(parseMvt("LO334/06.SPLVN.WAW"),null)});
test("date du vol d'après le jour du message et la réception",()=>{
  assert.equal(flightDateFromDay(6,"2026/10/06 09:30"),"2026-10-06");
  assert.equal(flightDateFromDay(30,"2026/10/01 00:20"),"2026-09-30");
  assert.equal(flightDateFromDay(1,"2026/09/30 23:50"),"2026-10-01");
});
test("applyMvt : ATD / décollage en heure de Paris, ATA et atterrissage en heure de destination",()=>{
  const dep={origin:"CDG",destination:"IST"},d=applyMvt(dep,parseMvt("TK1830/07.TCLTB.CDG\nAD0518/0531 EA0745 IST"),"2026-10-07");
  assert.equal(dep.atd,"07:18");assert.equal(dep.takeoff,"07:31");assert.equal(dep.eta,"10:45");assert.equal(dep.atdSource,"SITADOC_MVT");assert.ok(d.changed);
  const arr={origin:"CDG",destination:"WAW"};applyMvt(arr,parseMvt("LO334/06.SPLVN.WAW\nAA0718/0724"),"2026-10-06");
  assert.equal(arr.landing,"09:18");assert.equal(arr.ata,"09:24");
});
test("règles : valeur manuelle ou FlightStats gardée, valeur provisoire FIDS remplacée",()=>{
  const m=parseMvt("TK1830/07.TCLTB.CDG\nAD0518/0531");
  const manual={origin:"CDG",destination:"IST",atd:"07:20",atdSource:"MANUAL"};applyMvt(manual,m,"2026-10-07");assert.equal(manual.atd,"07:20");
  const fs={origin:"CDG",destination:"IST",atd:"07:19",atdSource:"PUBLIC_LIVE:FLIGHTSTATS"},r=applyMvt(fs,m,"2026-10-07");assert.equal(fs.atd,"07:19");assert.deepEqual(r.kept[0],{field:"atd",kept:"07:19",mvt:"07:18"});
  const fids={origin:"CDG",destination:"IST",atd:"07:20",atdSource:"PUBLIC_LIVE:FIDS_ONTIME"};applyMvt(fids,m,"2026-10-07");assert.equal(fids.atd,"07:18");
});
test("jeton obligatoire",()=>{
  const req=t=>({headers:{get:()=>t}});
  assert.equal(sitadocAuthorized(req("abc"),{}),false);assert.equal(sitadocAuthorized(req("abc"),{SITADOC_TOKEN:"abc"}),true);assert.equal(sitadocAuthorized(req("abd"),{SITADOC_TOKEN:"abc"}),false);
});
test("ingestMvt : trouve le vol du jour et enregistre l'ATD",async()=>{
  const writes=[],row={identity:"I1",flight_number:"TK1830",airline:"TK",data_json:JSON.stringify({airline:"TK",flight:"TK1830",origin:"CDG",destination:"IST",std:"07:20"})};
  const env={OPS_DB:{prepare:q=>({bind:(...a)=>({all:async()=>({results:q.includes("SELECT")?[row]:[]}),run:async()=>{writes.push(a)}})})}};
  const r=await ingestMvt(env,[{text:"TK1830/07.TCLTB.CDG\nAD0518/0531",receivedAt:"2026/10/07 07:25"},{text:"bonjour"},{text:"XX999/07.AAAAA.CDG\nAD0518/0531",receivedAt:"2026/10/07 07:25"}]);
  assert.equal(r.updated,1);assert.equal(r.results[0].status,"UPDATED");assert.equal(r.results[1].status,"NOT_MVT");assert.equal(r.results[2].status,"NO_FLIGHT");
  assert.equal(JSON.parse(writes[0][0]).atd,"07:18");
});
