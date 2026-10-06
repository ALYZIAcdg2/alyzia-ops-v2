import test from "node:test";import assert from "node:assert/strict";
import {guardArrivalClock} from "./local-time-guard.js";
const ctx={std:"10:10",sta:"12:15",date:"2026-10-05",originZone:"Europe/Paris",destZone:"America/Toronto"};   // CDG-YUL : 8 h 05 de vol
test("TS251 : atterrissage lu en heure de Paris (18:45) converti en heure de Montréal (12:45)",()=>{const r=guardArrivalClock("18:45",ctx);assert.equal(r.status,"SHIFTED");assert.equal(r.value,"12:45")});
test("heure déjà locale (12:45) : conservée",()=>{const r=guardArrivalClock("12:45",ctx);assert.equal(r.status,"OK");assert.equal(r.value,"12:45")});
test("gros retard (14:30 locale, +2 h 15) : conservé",()=>{assert.equal(guardArrivalClock("14:30",ctx).status,"OK")});
test("sans STA ou même fuseau : non vérifié",()=>{assert.equal(guardArrivalClock("18:45",{...ctx,sta:""}).status,"UNCHECKED");assert.equal(guardArrivalClock("18:45",{...ctx,destZone:"Europe/Paris"}).status,"UNCHECKED")});
test("vol court sur le même fuseau horaire logique (CDG-LHR) : pas de faux décalage",()=>{const r=guardArrivalClock("11:50",{std:"10:30",sta:"10:50",date:"2026-10-05",originZone:"Europe/Paris",destZone:"Europe/London"});assert.equal(r.status==="OK"||r.status==="UNCHECKED",true)});
import {fixArrivalClocks,sanitizeArrivalClocks} from "./ops-arrival-sanitizer.js";
const ts251={origin:"CDG",destination:"YUL",std:"10:10",sta:"12:15",takeoff:"10:36",landing:"18:45",ata:"18:55"};
test("TS251 enregistré : atterrissage et ATA corrigés",()=>{const c=fixArrivalClocks(ts251,"2026-10-05");assert.deepEqual(c.map(x=>[x.field,x.to]),[["landing","12:45"],["ata","12:55"]])});
test("valeurs déjà locales ou saisie manuelle : inchangées",()=>{assert.deepEqual(fixArrivalClocks({...ts251,landing:"12:45",ata:"12:55"},"2026-10-05"),[]);assert.deepEqual(fixArrivalClocks({...ts251,landingSource:"MANUAL",ataSource:"MANUAL"},"2026-10-05"),[])});
test("le passage corrige et écrit une seule fois",async()=>{const writes=[];const env={OPS_DB:{prepare:q=>({bind:(...a)=>({all:async()=>({results:[{identity:"1",flight_date:"2026-10-05",data_json:JSON.stringify(ts251)}]}),run:async()=>{writes.push(a)}})})}};
  const r=await sanitizeArrivalClocks(env,{nowMs:Date.parse("2026-10-05T20:00:00Z")});assert.equal(r.updated,1);assert.equal(r.fixed,2);const s=JSON.parse(writes[0][0]);assert.equal(s.landing,"12:45");assert.equal(s.flightInfoLog[0].source,"ARRIVAL_TZ_FIX")});
