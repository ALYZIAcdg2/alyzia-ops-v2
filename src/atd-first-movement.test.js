import test from "node:test";
import assert from "node:assert/strict";
import {moveAtdHit,fr24Semantic} from "./ops-public-live-flow-optimized.js";
import {fetchFr24Public} from "./fr24-public-html.js";
const NOW=Date.parse("2026-10-08T15:30:00Z");               // 17:30 Paris
test("ATD estimée : seulement après le TO (15 min), sans ATD, mouvement avant le TO de 90 min au plus",()=>{
  const fr={atdEst:"16:51"};
  assert.deepEqual(moveAtdHit({takeoff:"17:05"},fr,"17:05",NOW),{value:"16:51",source:"FR24MOVE"});
  assert.equal(moveAtdHit({takeoff:"17:20"},fr,"17:20",NOW),null);                       // TO il y a 10 min : trop tôt
  assert.equal(moveAtdHit({atd:"16:55",takeoff:"17:05"},fr,"17:05",NOW),null);            // une ATD existe déjà
  assert.equal(moveAtdHit({atdSource:"MANUAL",takeoff:"17:05"},fr,"17:05",NOW),null);
  assert.equal(moveAtdHit({},fr,"",NOW),null);                                             // pas de TO
  assert.equal(moveAtdHit({takeoff:"17:05"},{atdEst:"14:00"},"17:05",NOW),null);           // mouvement 3 h avant le TO : incohérent
  assert.equal(moveAtdHit({takeoff:"17:05"},{atdEst:"17:30"},"17:05",NOW),null);           // mouvement après le TO
  assert.equal(moveAtdHit({takeoff:"17:05"},{},"17:05",NOW),null);
});
test("passage de minuit : mouvement 23:50, TO 00:10",()=>{
  const now=Date.parse("2026-10-08T22:40:00Z");            // 00:40 Paris
  assert.deepEqual(moveAtdHit({takeoff:"00:10"},{atdEst:"23:50"},"00:10",now),{value:"23:50",source:"FR24MOVE"});
});
const flight={designator:"IZ742",airline:"IZ",number:"742",date:"2026-10-08",origin:"CDG",destination:"TLV",std:"16:00",id:"420823e9",raw:{fr24OccurrenceId:"420823e9"}};
test("la lecture FR24 donne le premier mouvement au sol avant le décollage",async()=>{
  const old=globalThis.fetch;
  const pt=(t,alt,spd)=>({timestamp:t,altitude:{feet:alt},speed:{kts:spd}});
  const T0=Date.parse("2026-10-08T14:51:00Z")/1000;
  const track=[pt(T0-300,0,0),pt(T0-60,0,2),pt(T0,0,9),pt(T0+120,0,18),pt(T0+500,100,150),pt(T0+560,800,170),pt(T0+700,5000,300)];
  globalThis.fetch=async url=>String(url).includes("flight-playback")?new Response(JSON.stringify({result:{response:{data:{flight:{identification:{number:{default:"IZ742"}},aircraft:{model:{code:"A320"},registration:"4X-AGV"},airport:{origin:{code:{iata:"CDG"}},destination:{code:{iata:"TLV"}}},time:{scheduled:{departure:T0-3000,arrival:T0+9000},real:{departure:T0+520,arrival:null},estimated:{}},track}}}}}),{status:200,headers:{"content-type":"application/json"}}):new Response("",{status:404});
  try{
    const r=await fetchFr24Public(flight);
    assert.equal(r.status,"OK");
    assert.equal(r.candidates.semantic.moveStart,new Date(T0*1000).toISOString());       // 2 kt ignoré, 9 kt retenu
    assert.equal(fr24Semantic(r,{...flight,destination:"TLV"}).atdEst,"16:51");
  }finally{globalThis.fetch=old}
});
import fs from "node:fs";
test("une ATD FR24MOVE reste remplaçable : relue par la file, remplaçable par le FIDS",()=>{
  const live=fs.readFileSync(new URL("./ops-public-live-flow-optimized.js",import.meta.url),"utf8");
  assert.match(live,/FIDS_ONTIME\|FR24MOVE/);
  const fids=fs.readFileSync(new URL("./fids-atd-sweep.js",import.meta.url),"utf8");
  assert.match(fids,/!\/FIDS\|FR24MOVE\/\.test\(upper\(x\.atdSource\)\)/);
});
