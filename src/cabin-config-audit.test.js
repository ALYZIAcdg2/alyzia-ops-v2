import test from "node:test";
import assert from "node:assert/strict";
import {auditFlight,runCabinConfigAudit} from "./cabin-config-audit.js";
const cat=[{config_key:"TK|N32|C20Y162",airline:"TK",aircraft:"N32",configuration:"C20Y162",total:182},{config_key:"AF|789|J30W20Y250",airline:"AF",aircraft:"789",configuration:"J30W20Y250",total:300}];
test("TK 32Q retrouve le plan N32 ; le choix et la capacité sont contrôlés",()=>{
  assert.equal(auditFlight({airline:"TK",flight:"TK1830",aircraft:"32Q"},cat).verdict,"NON CHOISI");
  assert.equal(auditFlight({airline:"TK",flight:"TK1830",aircraft:"32Q",sariaConfigKey:"TK|N32|C20Y162",config:{C:20,Y:162}},cat).verdict,"OK");
  assert.equal(auditFlight({airline:"TK",flight:"TK1830",aircraft:"32Q",sariaConfigKey:"TK|N32|C20Y162",config:{C:20,Y:150}},cat).verdict,"CAPACITÉ DIFFÉRENTE");
  assert.equal(auditFlight({airline:"TK",flight:"TK1830",aircraft:"32Q",sariaConfigKey:"TK|N32|C20Y162",config:{}},cat).verdict,"CONFIG VIDE");
});
test("NH 789 sans plan : PLAN ABSENT ; type manquant ; plan d'un autre type : INCOHÉRENT",()=>{
  assert.equal(auditFlight({airline:"NH",flight:"NH216",aircraft:"789"},cat).verdict,"PLAN ABSENT");
  assert.equal(auditFlight({airline:"NH",flight:"NH216"},cat).verdict,"TYPE MANQUANT");
  assert.equal(auditFlight({airline:"AF",flight:"AF1",aircraft:"789",sariaConfigKey:"TK|N32|C20Y162"},cat).verdict,"INCOHÉRENT");
});
test("audit du jour : résumé et types sans plan",async()=>{
  const flights=[{flight_number:"216",airline:"NH",data_json:JSON.stringify({airline:"NH",flight:"NH216",aircraft:"789"})},{flight_number:"1830",airline:"TK",data_json:JSON.stringify({airline:"TK",flight:"TK1830",aircraft:"32Q",sariaConfigKey:"TK|N32|C20Y162",config:{C:20,Y:162}})}];
  const env={OPS_DB:{prepare:q=>({bind:()=>({all:async()=>({results:flights})}),all:async()=>({results:cat})})}};
  const r=await runCabinConfigAudit(env,{date:"2026-10-06"});
  assert.equal(r.flights,2);assert.equal(r.ok_,1);assert.equal(r.planAbsent,1);assert.deepEqual(r.typesSansPlan,[{type:"NH 789",flights:1}]);
});
