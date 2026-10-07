import test from "node:test";
import assert from "node:assert/strict";
import {syncSeedIntoD1} from "./cabin-seed-sync.js";
function fakeEnv({existing=[],synced=null}={}){
  const log={meta:null};
  const stmt=sql=>{let args=[];const o={bind:(...a)=>{args=a;return o},
    run:async()=>{if(/INSERT INTO ops_meta/.test(sql))log.meta=JSON.parse(args[1]);return {meta:{changes:1}}},
    all:async()=>({results:existing.map(k=>({config_key:k}))}),
    first:async()=>synced?{v:JSON.stringify(synced)}:null};return o};
  return {log,OPS_DB:{prepare:stmt}};
}
const seed=["TK|78D|16C135Y","JU|319|144Y","NH|789|48C21E146Y"].map(configKey=>({configKey}));
const makeWriter=()=>{const w=[];const fn=async(env,row)=>{w.push(row.configKey);return {configs:1}};fn.w=w;return fn};
test("première synchronisation : seuls les plans absents de D1 sont ajoutés, jamais réécrits",async()=>{
  const e=fakeEnv({existing:["TK|78D|16C135Y"]}),wr=makeWriter();
  const r=await syncSeedIntoD1(e,seed,wr);
  assert.equal(r.ok,true);assert.deepEqual(wr.w,["JU|319|144Y","NH|789|48C21E146Y"]);assert.equal(r.written,2);assert.equal(e.log.meta.length,3);
});
test("déjà synchronisé : rien n'est recréé, même si un plan a été supprimé à la main",async()=>{
  const e=fakeEnv({existing:["TK|78D|16C135Y"],synced:seed.map(c=>c.configKey)}),wr=makeWriter();
  const r=await syncSeedIntoD1(e,seed,wr);
  assert.equal(r.upToDate,true);assert.deepEqual(wr.w,[]);
});
test("nouveau plan au seed après une synchronisation : seul lui est ajouté",async()=>{
  const e=fakeEnv({existing:["TK|78D|16C135Y"],synced:seed.map(c=>c.configKey)}),wr=makeWriter();
  const r=await syncSeedIntoD1(e,[...seed,{configKey:"TK|79D|X"}],wr);
  assert.deepEqual(wr.w,["TK|79D|X"]);assert.equal(r.written,1);
});
test("échec d'écriture : la synchronisation n'est pas marquée terminée",async()=>{
  const e=fakeEnv(),r=await syncSeedIntoD1(e,seed,async()=>{throw new Error("boom")});
  assert.equal(r.ok,false);assert.equal(e.log.meta,null);
});
