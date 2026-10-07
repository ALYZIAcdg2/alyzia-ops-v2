import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {lockPaidApis,paidApiStatus,PAID_SECRETS} from "./paid-api-lock.js";
const mk=extra=>({OPS_DB:{prepare:()=>({bind:()=>({all:async()=>({results:[{provider:"AIRLABS",calls:0}]})})})},AIRLABS_API_KEY:"secret1",OAG_API_KEY:"secret2",OPENSKY_INGEST_TOKEN:"keep",ALYZIA_API_SECRET:"keep2",...extra});
test("verrou : les secrets payants disparaissent pour le code, le reste de l'environnement est intact",()=>{
  const env=lockPaidApis(mk());
  for(const k of PAID_SECRETS)assert.equal(env[k],undefined);
  assert.equal(env.OPENSKY_INGEST_TOKEN,"keep");assert.equal(env.ALYZIA_API_SECRET,"keep2");assert.equal(typeof env.OPS_DB.prepare,"function");
  assert.equal("AIRLABS_API_KEY" in env,false);
});
test("réactivation explicite avec PAID_APIS_ENABLED=1",()=>{
  const env=lockPaidApis(mk({PAID_APIS_ENABLED:"1"}));assert.equal(env.AIRLABS_API_KEY,"secret1");
});
test("état en lecture seule : booléens (jamais les valeurs) et appels du jour",async()=>{
  const st=await paidApiStatus(mk());
  assert.equal(st.locked,true);assert.equal(st.secretsConfigured.AIRLABS_API_KEY,true);assert.equal(st.secretsConfigured.SKYLINK_API_KEY,false);
  assert.equal(JSON.stringify(st).includes("secret1"),false);assert.equal(st.usageToday.length,1);
});
test("ADMIN : le plan PROCHAIN n'affiche plus de fournisseur payant",()=>{
  const src=readFileSync(new URL("./admin-dashboard-v5-wrapper.js",import.meta.url),"utf8");
  const i=src.indexOf("function planFromRow(tr){"),j=src.indexOf("function patchRows(){"),plan=src.slice(i,j);
  assert.doesNotMatch(plan,/AIRLABS|SKYLINK|OAG|AERODATABOX|OPENSKY/);
  assert.match(plan,/FIDS/);assert.match(plan,/FLIGHTSTATS/);
});
