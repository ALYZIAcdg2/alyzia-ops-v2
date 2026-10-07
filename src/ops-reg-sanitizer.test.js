import test from "node:test";
import assert from "node:assert/strict";
import {salvageRegistration,registrationFromLog,sanitizeTodayRegistrations} from "./ops-reg-sanitizer.js";

test("immat dupliquée sur deux vols : on garde l'autre champ valide (aircraftRegistration)",()=>{
  const x={reg:"D-AIHV",registration:"D-AIHV",aircraftRegistration:"SP-LVA"};
  assert.equal(salvageRegistration(x,["reg","registration","aircraftRegistration"],new Set()),"SP-LVA");
  assert.equal(salvageRegistration({reg:"D-AIHV",registration:"D-AIHV",aircraftRegistration:"D-AIHV"},["reg","registration","aircraftRegistration"],new Set()),"");
  assert.equal(salvageRegistration(x,["reg","registration","aircraftRegistration"],new Set(["SPLVA"])),"");
});
test("vol déjà vidé : la bonne immat est reprise dans le journal (REG_DUPLICATE)",()=>{
  const x={flightInfoLog:[{source:"REG_DUPLICATE",field:"reg",from:"reg=D-AIHV / registration=D-AIHV / aircraftRegistration=SP-LVA",to:""}]};
  assert.equal(registrationFromLog(x,new Set()),"SP-LVA");
  assert.equal(registrationFromLog({...x,reg:"TC-LTB"},new Set()),"");
  assert.equal(registrationFromLog(x,new Set(["SPLVA"])),"");
  assert.equal(registrationFromLog({flightInfoLog:[{source:"REG_DUPLICATE",from:"reg=D-AIHV / registration=D-AIHV",to:""}]},new Set()),"");
});
test("passage complet : deux vols avec D-AIHV retrouvent chacun leur immat",async()=>{
  const day=new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const rows=[
    {identity:"A",data_json:JSON.stringify({std:"07:05",origin:"CDG",reg:"D-AIHV",registration:"D-AIHV",aircraftRegistration:"SP-LVA"})},
    {identity:"B",data_json:JSON.stringify({std:"07:20",origin:"CDG",reg:"D-AIHV",registration:"D-AIHV",aircraftRegistration:"TC-LTB"})},
    {identity:"C",data_json:JSON.stringify({std:"09:00",origin:"CDG",flightInfoLog:[{source:"REG_DUPLICATE",field:"reg",from:"reg=D-AIHV / aircraftRegistration=EI-GED",to:""}]})}
  ],saved={};
  const env={OPS_DB:{prepare:q=>({bind:(...a)=>({all:async()=>({results:rows}),run:async()=>{saved[a[1]]=JSON.parse(a[0])}}),all:async()=>({results:rows})})}};
  const r=await sanitizeTodayRegistrations(env);
  assert.equal(r.ok,true);assert.equal(saved.A.reg,"SP-LVA");assert.equal(saved.A.aircraftRegistration,"SP-LVA");assert.equal(saved.B.reg,"TC-LTB");assert.equal(saved.C.reg,"EI-GED");
  assert.equal(saved.A.regSource,"REG_SANITIZER_KEPT");assert.equal(saved.A.flightInfoLog[0].to,"SP-LVA");
});
