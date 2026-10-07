import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {splitFlight,applyDeparture,ingestDepartures} from "./sitadoc-departures.js";
const {rowFromCells}=createRequire(import.meta.url)("../scripts/sitadoc-collector.user.js");

const cells=["Messages","InfoVol","C11","TK 1830","07:20","07:20","","HTD","07:20","PAX","IST","INT","TCLTB","32Q","U17","32","317-323","153",""];
test("collecteur : ligne du tableau -> objet (date prise dans le lien du vol)",()=>{
  const r=rowFromCells(cells,"details_tvm.php?site=D&tri=TK 1830&date=20261007&rot=TK 1829/06OCT/22:30&page=4&htda=07:20&id=1");
  assert.deepEqual([r.date,r.flight,r.sch,r.tsa,r.code,r.reg,r.type,r.gate,r.pax],["2026-10-07","TK 1830","07:20","07:20","HTD","TCLTB","32Q","32","153"]);
  assert.equal(rowFromCells(["a","b"],"x"),null);assert.equal(rowFromCells(cells,"sans-date"),null);
});
test("vol « TK 1830 » -> compagnie et numéro",()=>{assert.deepEqual(splitFlight("TK 1830"),{airline:"TK",number:"1830"});assert.deepEqual(splitFlight("3O 828"),{airline:"3O",number:"828"});assert.equal(splitFlight("???"),null)});

test("départ bloc (HDB) = ATD, QTN = décollage ; STD jamais modifiée",()=>{
  const x={origin:"CDG",std:"07:20",sta:"11:00"};
  const r=applyDeparture(x,{code:"QTN",hpd:"07:34",hdb:"07:21",tsa:"07:20"});
  assert.equal(x.atd,"07:21");assert.equal(x.takeoff,"07:34");assert.equal(x.atdSource,"SITADOC");assert.equal(x.std,"07:20");assert.equal(x.sta,"11:00");assert.ok(r.changed);
});
test("MER (moteurs) et HTD ne donnent ni ATD ni décollage ; HED donne l'ETD s'il est vide",()=>{
  const a={origin:"CDG"};applyDeparture(a,{code:"MER",hpd:"07:15"});assert.equal(a.atd,undefined);assert.equal(a.takeoff,undefined);
  const b={origin:"CDG"};applyDeparture(b,{code:"HED",hpd:"07:39"});assert.equal(b.etd,"07:39");
  const c={origin:"CDG",etd:"07:19"};applyDeparture(c,{code:"HED",hpd:"07:39"});assert.equal(c.etd,"07:19");
});
test("ATD : manuel et FlightStats gardés, FIDS « à l'heure » remplacé",()=>{
  const m={atd:"07:30",atdSource:"MANUAL"};applyDeparture(m,{hdb:"07:21"});assert.equal(m.atd,"07:30");
  const f={atd:"07:22",atdSource:"PUBLIC_LIVE:FLIGHTSTATS"},r=applyDeparture(f,{hdb:"07:21"});assert.equal(f.atd,"07:22");assert.equal(r.kept[0].mvt,"07:21");
  const d={atd:"07:20",atdSource:"PUBLIC_LIVE:FIDS_ONTIME"};applyDeparture(d,{hdb:"07:21"});assert.equal(d.atd,"07:21");
});
test("comparaison : immat, porte et type différents signalés, rien écrasé",()=>{
  const x={reg:"TC-LTA",gate:"31",aircraft:"333"};
  const r=applyDeparture(x,{reg:"TCLTB",gate:"32",type:"32Q",code:"HTD",hpd:"07:20"});
  assert.deepEqual(Object.keys(r.diff).sort(),["gate","reg","type"]);assert.equal(x.reg,"TC-LTA");assert.equal(x.gate,"31");assert.equal(x.sitadoc.reg,"TCLTB");
});
test("ingestDepartures : rapprochement strict par vol + STD, ATD enregistré",async()=>{
  const writes=[],row={identity:"I1",flight_number:"TK1830",airline:"TK",std:"07:20",data_json:JSON.stringify({airline:"TK",flight:"TK1830",origin:"CDG",std:"07:20"})};
  const env={OPS_DB:{prepare:q=>({bind:()=>({all:async()=>({results:q.includes("SELECT")?[row]:[]}),run:async()=>{writes.push(1)}})})}};
  const r=await ingestDepartures(env,[
    {date:"2026-10-07",flight:"TK 1830",sch:"07:20",code:"HDB",hpd:"07:21",hdb:"07:21"},
    {date:"2026-10-07",flight:"TK 1830",sch:"07:25",code:"HDB",hpd:"07:21"},
    {date:"2026-10-07",flight:"AF 1",sch:"07:20"},{flight:"?"}]);
  assert.deepEqual(r.results.map(x=>x.status),["UPDATED","NO_FLIGHT","NO_FLIGHT","BAD_ROW"]);assert.equal(writes.length,1);assert.equal(r.updated,1);
});
