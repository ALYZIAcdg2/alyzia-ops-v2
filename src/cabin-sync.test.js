import test from "node:test";
import assert from "node:assert/strict";
import {syncCabinAfterAircraftChange} from "./cabin-sync.js";
const mkEnv=(rows,bare=[])=>{const writes=[];return {writes,OPS_DB:{prepare:q=>({bind:(...a)=>({all:async()=>({results:q.includes("'$.sariaConfigKey'")?bare:rows}),run:async()=>{writes.push(a)}})})}}};
test("aucun vol avec changement d'appareil : rien à faire",async()=>{const e=mkEnv([]);const r=await syncCabinAfterAircraftChange(e);assert.deepEqual([r.checked,r.updated],[0,0]);assert.equal(e.writes.length,0)});
test("la config suit le type réel ; écrit seulement si elle a changé",async()=>{
  const rows=[{identity:"1",data_json:JSON.stringify({airline:"TK",flight:"TK1822",aircraft:"77B",aircraftChange:{from:"77B",to:"333"}})},{identity:"2",data_json:JSON.stringify({airline:"TK",flight:"TK9",aircraftChange:{from:"32Q",to:"32Q"}})},{identity:"3",data_json:JSON.stringify({airline:"TK",flight:"TK3"})}];
  const e=mkEnv(rows);
  const r=await syncCabinAfterAircraftChange(e,{apply:async(env,x)=>{if(x.flight==="TK1822"){x.sariaConfigKey="TK|333|X";return true}return false}});
  assert.deepEqual([r.checked,r.updated],[3,1]);assert.equal(e.writes.length,1);assert.equal(JSON.parse(e.writes[0][0]).sariaConfigKey,"TK|333|X");
});
test("vol sans plan choisi : choix automatique écrit",async()=>{
  const e=mkEnv([],[{identity:"9",data_json:JSON.stringify({airline:"LY",flight:"LY222",aircraft:"739"})}]);
  const r=await syncCabinAfterAircraftChange(e,{autoApply:async(env,x)=>{x.sariaConfigKey="LY|739|X"}});
  assert.deepEqual([r.checked,r.updated],[1,1]);assert.equal(JSON.parse(e.writes[0][0]).sariaConfigKey,"LY|739|X");
});
test("airline absent du JSON : repris de la colonne pour choisir le plan",async()=>{
  const e=mkEnv([],[{identity:"8",airline:"JU",flight_number:"JU241",data_json:JSON.stringify({aircraft:"320"})}]);
  let seen=null;
  const r=await syncCabinAfterAircraftChange(e,{autoApply:async(env,x)=>{seen=x.airline+"|"+x.flight;x.sariaConfigKey="JU|320|180Y"}});
  assert.equal(seen,"JU|JU241");assert.equal(r.updated,1);
});
