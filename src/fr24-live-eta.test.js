import test from "node:test";
import assert from "node:assert/strict";
import {fetchFr24Public} from "./fr24-public-html.js";
const flight={designator:"TU2655",airline:"TU",number:"2655",date:"2026-10-08",origin:"CDG",destination:"DJE",std:"19:45",raw:{fr24OccurrenceId:"420a1d3c"}};
const json=(o)=>new Response(JSON.stringify(o),{status:200,headers:{"content-type":"application/json"}});
const base={identification:{id:"420a1d3c",number:{default:"TU2655"},callsign:"TAR2655"},status:{text:"Delayed 04:17"},aircraft:{model:{code:"A320"},registration:"TS-IMS"},airport:{origin:{code:{iata:"CDG"}},destination:{code:{iata:"DJE"}}}};
test("vol en l'air : l'arrivée estimée vient de la page de suivi FR24 (clickhandler), pas calculée",async()=>{
  const old=globalThis.fetch,urls=[];
  globalThis.fetch=async url=>{url=String(url);urls.push(url);
    if(url.includes("flight-playback"))return json({result:{response:{data:{flight:{...base,time:{scheduled:{departure:1791481500,arrival:1791491160},real:{departure:1791507471,arrival:null},estimated:{departure:null,arrival:null}}}}}}});
    if(url.includes("clickhandler"))return json({...base,time:{scheduled:{departure:1791481500,arrival:1791491160},real:{departure:1791507471,arrival:null},estimated:{departure:null,arrival:1791515856},other:{eta:1791515856}}});
    return new Response("",{status:404})};
  try{
    const r=await fetchFr24Public({...flight,raw:{...flight.raw},id:"420a1d3c"});
    assert.equal(r.status,"OK");
    assert.equal(r.candidates.semantic.eta,new Date(1791515856*1000).toISOString());
    assert.equal(r.candidates.semantic.takeoff,new Date(1791507471*1000).toISOString());
    assert.ok(urls.some(u=>u.includes("clickhandler")));
  }finally{globalThis.fetch=old}
});
test("vol pas décollé ou déjà atterri : pas d'appel supplémentaire",async()=>{
  const old=globalThis.fetch,urls=[];
  globalThis.fetch=async url=>{url=String(url);urls.push(url);
    if(url.includes("flight-playback"))return json({result:{response:{data:{flight:{...base,identification:{...base.identification,id:"9999aaaa"},time:{scheduled:{departure:1791481500,arrival:1791491160},real:{departure:1791507471,arrival:1791515000},estimated:{departure:null,arrival:null}}}}}}});
    return new Response("",{status:404})};
  try{
    await fetchFr24Public({...flight,raw:{fr24OccurrenceId:"9999aaaa"}});
    assert.equal(urls.some(u=>u.includes("clickhandler")),false);
  }finally{globalThis.fetch=old}
});
