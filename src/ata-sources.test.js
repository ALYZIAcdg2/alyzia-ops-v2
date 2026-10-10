import test from "node:test";import assert from "node:assert/strict";
import {ataSources} from "./ata-sources.js";
test("ataSources regroupe les ATA par source et compte les vols sans ATA",()=>{
  const r=ataSources([
    {flight:"A1",std:"10:00",ata:"12:00",ataSource:"PUBLIC_LIVE:FIDS",landing:"11:50"},
    {flight:"A2",std:"11:00",ata:"13:00",ataSource:"PUBLIC_LIVE:DERIVED"},
    {flight:"A3",std:"12:00",ata:"12:30"},
    {flight:"A4",std:"12:00",takeoff:"12:10"},
    {flight:"A5",std:"12:00"}]);
  assert.equal(r.total,3);assert.equal(r.withoutAta,1);
  assert.equal(r.bySource["PUBLIC_LIVE:FIDS"],1);assert.equal(r.bySource["(source non enregistrée)"],1);
  assert.equal(r.flights[0].flight,"A1");
});
