import test from "node:test";
import assert from "node:assert/strict";
import {fetchFr24Public} from "./fr24-public-html.js";
import {fr24Semantic} from "./ops-public-live-flow-optimized.js";
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

const histHtml=`<table><tr><td>08 Oct 2026</td><td>Paris (CDG)</td><td>Djerba (DJE)</td><td>A320 (TS-IMS)</td><td>STD 19:45</td><td>ATD 02:57</td><td>STA 21:26</td><td>Landed 04:19</td></tr></table>`;
function landingMock(urls,{realArrival=null,etaSec}){
  const pt=(t,alt,spd)=>({timestamp:t,altitude:{feet:alt},speed:{kts:spd}});
  const T0=Date.parse("2026-10-09T00:45:00Z")/1000;
  const track=[pt(T0,0,9),pt(T0+500,100,150),pt(T0+560,800,170),pt(T0+700,5000,300)];
  return async url=>{url=String(url);urls.push(url);
    if(url.includes("flight-playback"))return new Response(JSON.stringify({result:{response:{data:{flight:{identification:{number:{default:"TU2656"}},aircraft:{model:{code:"A320"},registration:"TS-IMS"},airport:{origin:{code:{iata:"CDG"}},destination:{code:{iata:"DJE"}}},time:{scheduled:{departure:T0-3000,arrival:T0+9000},real:{departure:T0+520,arrival:realArrival},estimated:{arrival:etaSec}},track}}}}}),{status:200,headers:{"content-type":"application/json"}});
    if(url.includes("/data/flights/tu2656"))return new Response(histHtml,{status:200,headers:{"content-type":"text/html"}});
    return new Response("",{status:404})};
}
const flight2={designator:"TU2656",airline:"TU",number:"2656",date:"2026-10-08",origin:"CDG",destination:"DJE",std:"19:45",raw:{fr24OccurrenceId:"420a1d3c"}};
test("vol posé que la réponse playback ne donne pas encore : l'atterrissage est lu dans l'historique FR24",async()=>{
  const old=globalThis.fetch,urls=[];
  const etaPast=Date.parse("2026-10-09T03:20:00Z")/1000-3*3600;   // estimée il y a des heures
  globalThis.fetch=landingMock(urls,{etaSec:etaPast});
  try{
    const r=await fetchFr24Public({...flight2,raw:{fr24OccurrenceId:"hist0001"}});
    assert.equal(r.candidates.semantic.landingClock,"04:19");
    assert.equal(fr24Semantic(r,flight2).landing,"04:19");
    assert.ok(urls.some(u=>u.includes("/data/flights/tu2656")));
  }finally{globalThis.fetch=old}
});
test("arrivée estimée encore lointaine : pas de lecture de l'historique",async()=>{
  const old=globalThis.fetch,urls=[];
  globalThis.fetch=landingMock(urls,{etaSec:Math.floor(Date.now()/1000)+4*3600});
  try{
    await fetchFr24Public({...flight2,raw:{fr24OccurrenceId:"hist0002"}});
    assert.equal(urls.some(u=>u.includes("/data/flights/tu2656")),false);
  }finally{globalThis.fetch=old}
});
