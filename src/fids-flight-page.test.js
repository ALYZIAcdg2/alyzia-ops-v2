import test from "node:test";import assert from "node:assert/strict";
import {parseFlightPage,pageAta,pageAtd,flightPageUrl,wantsPage,sweepFidsFlightPages,_resetFlightPageMemo} from "./fids-flight-page.js";
const html=(da,aa)=>`<div class="board__header-status  bg-secondary ">
 landed
</div><div class="airport">Departure: CDG</div><div class="departure-times">Flight Departure Times<br />October 09, 2026</div>
<div class="times"><div class="scheduled">Scheduled<br /><strong>07:20</strong></div><div class="actual">
 Actual<br /><strong
 >${da}</strong></div></div>
<div class="airport">Arrival: IST</div><div class="arrival-times">Flight Arrival Times<br />October 09, 2026</div>
<div class="times"><div class="scheduled">Scheduled<br /><strong>12:00</strong></div><div class="actual">
 Actual<br /><strong
 >${aa}</strong></div></div>`;
test("parse la page TK1830",()=>{
  const p=parseFlightPage(html("07:25","11:51"));
  assert.deepEqual(parseFlightPage(".board__header-status{height:93px}"+html("07:25","11:51")),{status:"landed",atd:"07:25",ata:"11:51"});
  assert.deepEqual(p,{status:"landed",atd:"07:25",ata:"11:51"});
  assert.equal(parseFlightPage("<html>erreur</html>"),null);
  assert.equal(parseFlightPage(html("07:25","").replace(/Actual<br \/><strong\s*>\s*</,"X<")).ata,"");
});
test("URL et plausibilité",()=>{
  assert.equal(flightPageUrl({flight:"TK1830",dest:"IST",date:"2026-10-09",std:"07:20"}),"https://fids.flightradar.live/flight-status/TK1830/CDG/IST/202610090720");
  const p={atd:"07:25",ata:"11:51"};
  assert.equal(pageAta(p,{landing:"11:32"}),"11:51");
  assert.equal(pageAta(p,{landing:"11:50"}),"");
  assert.equal(pageAtd(p,{takeoff:"07:40"}),"07:25");
  assert.equal(pageAtd(p,{takeoff:"07:00"}),"");
});
test("wantsPage : saisie manuelle et ATA FIDS déjà posée exclues",()=>{
  const b={origin:"CDG",destination:"IST",landing:"11:32",takeoff:"07:40",atd:"07:25",atdSource:"PUBLIC_LIVE:FIDS"};
  assert.equal(wantsPage(b,0),true);
  assert.equal(wantsPage({...b,ata:"11:42",ataSource:"PUBLIC_LIVE:DERIVED_LANDING_PLUS_10"},0),true);
  assert.equal(wantsPage({...b,ata:"11:42",ataSource:"MANUAL"},0),false);
  assert.equal(wantsPage({...b,ata:"11:51",ataSource:"PUBLIC_LIVE:FIDS"},0),false);
  assert.equal(wantsPage({...b,ata:"11:51",ataSource:"PUBLIC_LIVE:FLIGHTSTATS"},0),false);
});
test("le passage remplace l'ATA calculée par l'ATA du FIDS",async()=>{
  _resetFlightPageMemo();
  const x={flight:"TK1830",airline:"TK",origin:"CDG",destination:"IST",std:"07:20",takeoff:"07:40",atd:"07:25",atdSource:"PUBLIC_LIVE:FIDS",landing:"11:32",ata:"11:42",ataSource:"PUBLIC_LIVE:DERIVED_LANDING_PLUS_10"};
  let saved=null;
  const env={OPS_DB:{prepare:sql=>({bind:(...a)=>({all:async()=>({results:[{identity:"i1",flight_date:"2026-10-09",airline:"TK",flight_number:"1830",std:"07:20",data_json:JSON.stringify(x)}]}),run:async()=>{saved=JSON.parse(a[0])}})})}};
  const urls=[];
  const r=await sweepFidsFlightPages(env,{nowMs:Date.parse("2026-10-09T10:00:00Z"),fetchImpl:async u=>{urls.push(u);return {ok:true,text:async()=>html("07:25","11:51")}}});
  assert.equal(r.updated,1);assert.equal(saved.ata,"11:51");assert.equal(saved.ataSource,"PUBLIC_LIVE:FIDS");
  assert.match(urls[0],/TK1830\/CDG\/IST\/202610090720$/);
  const r2=await sweepFidsFlightPages(env,{nowMs:Date.parse("2026-10-09T10:01:00Z"),fetchImpl:async()=>{throw new Error("no")}});
  assert.equal(r2.candidates,0);
});

test("les vols du jour passent avant ceux d'hier",async()=>{
  _resetFlightPageMemo();
  const mk=(id,date,std,extra={})=>({identity:id,flight_date:date,airline:"TK",flight_number:"1",std,data_json:JSON.stringify({flight:id,airline:"TK",origin:"CDG",destination:"IST",std,takeoff:"09:00",landing:"12:00",...extra})});
  const rows=[mk("OLD1","2026-10-08","09:00"),mk("OLD2","2026-10-08","22:00"),mk("NEW1","2026-10-09","09:00")];
  const env={OPS_DB:{prepare:()=>({bind:()=>({all:async()=>({results:rows}),run:async()=>{}})})}};
  const seen=[];
  await sweepFidsFlightPages(env,{dryRun:true,nowMs:Date.parse("2026-10-09T10:00:00Z"),fetchImpl:async u=>{seen.push(u);return {ok:false,status:410}}});
  assert.equal(seen.length,3);assert.match(seen[0],/NEW1/);   // les vols d'aujourd'hui d'abord ; ceux d'hier ensuite (pour constater que leur page a disparu)
});

test("ATA de la page sans atterrissage connu : plausible selon le temps depuis le décollage (heures converties en UTC)",()=>{
  const now=Date.parse("2026-10-09T12:00:00Z");
  const x={origin:"CDG",destination:"IST",takeoff:"07:40"};
  assert.equal(pageAta({ata:"11:51"},x,now),"11:51");   // 3 h 11 de vol
  assert.equal(pageAta({ata:"07:50"},x,now),"");        // arrivée avant même le décollage + durée : refusée
});

import {wantsPage as wp} from "./fids-flight-page.js";
test("la page FIDS est relue à chaque passage du cron (toutes les 2 min, sans risque de pause) tant que l'ATA réelle n'est pas écrite",async()=>{
  _resetFlightPageMemo();
  const x={flight:"AH1115",airline:"AH",origin:"CDG",destination:"BJA",std:"19:25",takeoff:"19:59",atd:"19:30",atdSource:"PUBLIC_LIVE:FIDS"};
  const env={OPS_DB:{prepare:()=>({bind:()=>({all:async()=>({results:[{identity:"i1",flight_date:"2026-10-09",airline:"AH",flight_number:"1115",std:"19:25",data_json:JSON.stringify(x)}]}),run:async()=>{}})})}};
  let calls=0;const fetchImpl=async()=>{calls++;return {ok:true,text:async()=>"<html>vide</html>"}};
  const t0=Date.parse("2026-10-09T21:00:00Z");
  await sweepFidsFlightPages(env,{fetchImpl,nowMs:t0});
  await sweepFidsFlightPages(env,{fetchImpl,nowMs:t0+60000});       // trop tôt (60 s)
  await sweepFidsFlightPages(env,{fetchImpl,nowMs:t0+120000});      // passage suivant (2 min) : relu
  await sweepFidsFlightPages(env,{fetchImpl,nowMs:t0+240000});      // et encore
  assert.equal(calls,3);
});

test("page disparue (410) : le vol est marqué une fois (fidsPageGoneAt) pour que FlightStats prenne le relais ; rien n'est marqué à blanc",async()=>{
  _resetFlightPageMemo();
  const x={flight:"AH1115",airline:"AH",origin:"CDG",destination:"BJA",std:"19:25",takeoff:"19:59",atd:"19:30"};
  const writes=[];const env={OPS_DB:{prepare:()=>({bind:(...a)=>({all:async()=>({results:[{identity:"i1",flight_date:"2026-10-09",airline:"AH",flight_number:"1115",std:"19:25",data_json:JSON.stringify(x)}]}),run:async()=>{writes.push(JSON.parse(a[0]))}})})}};
  const gone=async()=>({ok:false,status:410,text:async()=>""});
  await sweepFidsFlightPages(env,{fetchImpl:gone,nowMs:Date.parse("2026-10-09T21:00:00Z"),dryRun:true});
  assert.equal(writes.length,0);
  await sweepFidsFlightPages(env,{fetchImpl:gone,nowMs:Date.parse("2026-10-09T21:00:00Z")});
  assert.equal(writes.length,1);assert.ok(writes[0].fidsPageGoneAt);
});
