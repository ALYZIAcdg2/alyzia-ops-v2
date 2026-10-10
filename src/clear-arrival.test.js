import test from "node:test";import assert from "node:assert/strict";
import {clearArrival,clearArrivalFields} from "./clear-arrival.js";
const NOW=Date.parse("2026-10-10T08:00:00Z"),at="2026-10-10T08:00:00.000Z";
const flight={flight:"DE4292",ata:"09:23",ataSource:"PUBLIC_LIVE:FIDS",ataUpdatedAt:"x",landing:"09:15",landingSource:"PUBLIC_LIVE:FR24",atd:"08:10",atdSource:"PUBLIC_LIVE:FIDS",fsRepairAt:"y",publicLiveBackfill:{checkedAt:"z",attempts:[]}};
function mkEnv(x,date="2026-10-10"){let saved=null;
  const env={OPS_DB:{prepare(sql){return {bind(...a){this.a=a;return this},async all(){return {results:[{identity:"id1",flight_number:"DE4292",data_json:JSON.stringify(x)}]}},async run(){if(sql.startsWith("UPDATE"))saved=JSON.parse(this.a[0]);return {}}}}}};
  return {env,saved:()=>saved};
}
test("clearArrivalFields : vide ATA et LDG (valeur, source, date), garde l'ATD, note l'opération",()=>{
  const n=clearArrivalFields(flight,at);
  assert.equal(n.ata,undefined);assert.equal(n.ataSource,undefined);assert.equal(n.landing,undefined);assert.equal(n.landingSource,undefined);
  assert.equal(n.atd,"08:10");assert.equal(n.fsRepairAt,undefined);assert.equal(n.publicLiveBackfill.checkedAt,"");
  assert.deepEqual(n.flightInfoLog.map(l=>[l.source,l.field,l.from,l.to]),[["ADMIN_RESET","landing","09:15",""],["ADMIN_RESET","ata","09:23",""]]);
});
test("aperçu (GET) : rien n'est écrit",async()=>{
  const {env,saved}=mkEnv(flight);const r=await clearArrival(env,{flight:"DE4292",date:"2026-10-10",dryRun:true,nowMs:NOW});
  assert.equal(r.ok,true);assert.equal(r.mode,"CLEAR_ARRIVAL_PREVIEW");assert.equal(r.before.ata.value,"09:23");assert.equal(r.after.ata.value,"");assert.equal(saved(),null);
});
test("POST : vidé et enregistré",async()=>{
  const {env,saved}=mkEnv(flight);const r=await clearArrival(env,{flight:"DE4292",date:"2026-10-10",dryRun:false,nowMs:NOW});
  assert.equal(r.mode,"CLEAR_ARRIVAL_APPLIED");assert.equal(saved().ata,undefined);assert.equal(saved().landing,undefined);assert.equal(saved().atd,"08:10");
});
test("champ saisi à la main : refusé, rien n'est écrit",async()=>{
  const {env,saved}=mkEnv({...flight,ataSource:"MANUAL"});const r=await clearArrival(env,{flight:"DE4292",date:"2026-10-10",dryRun:false,nowMs:NOW});
  assert.equal(r.ok,false);assert.match(r.error,/CHAMP_MANUEL/);assert.equal(saved(),null);
});
test("date trop ancienne et vol inconnu : refusés",async()=>{
  const {env}=mkEnv(flight);
  assert.match((await clearArrival(env,{flight:"DE4292",date:"2026-10-05",nowMs:NOW})).error,/DATE_REFUSEE/);
  assert.equal((await clearArrival(env,{flight:"ZZ1",date:"2026-10-10",nowMs:NOW})).error,"FLIGHT_NOT_FOUND");
  assert.equal((await clearArrival(env,{flight:"",nowMs:NOW})).ok,false);
});
