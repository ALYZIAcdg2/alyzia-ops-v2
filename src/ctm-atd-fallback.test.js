import test from 'node:test';
import assert from 'node:assert/strict';
import {applyRunV4} from './public-web-apply-v4.js';

async function apply(data, values=[]){
  let saved;
  const env={OPS_DB:{}};
  env.OPS_DB.prepare=(sql)=>({args:[],bind(...args){this.args=args;return this},async first(){return sql.includes('public_web_test_runs')?{status:'DONE'}:{data_json:JSON.stringify(data)}},async all(){return {results:sql.includes('DISTINCT')?[{flight_identity:data.airline==='SQ'?'2026-10-01|SQ|335|CDG|SIN':'2026-10-01|CTM|21|CDG|EVX'}]:sql.includes('chosen_value')?values:[]}},async run(){saved=JSON.parse(this.args[0]);return {success:true}}});
  const result=await applyRunV4(env,'test');return {data:saved||data,result};
}
test('CTM missing ATD uses takeoff and keeps provenance',async()=>{
  const {data,result}=await apply({airline:'CTM',takeoff:'02:49'});
  assert.equal(data.atd,'02:49');assert.equal(data.atdSource,'DERIVED:CTM_TAKEOFF');assert.equal(data.atdDerived,true);assert.equal(result.derivedCtmAtd,1);
});
test('non CTM flights never receive takeoff as ATD',async()=>{
  const {data}=await apply({airline:'SQ',takeoff:'02:49'});assert.equal(data.atd,undefined);
});
test('real and manual ATD stay protected',async()=>{
  for(const initial of [{atd:'02:40',atdSource:'FLIGHTAWARE'},{manualOverrides:{atd:true}},{atdSource:'MANUAL'}]){
    const {data}=await apply({airline:'CTM',takeoff:'02:49',...initial});assert.equal(data.atd,initial.atd);
  }
});
test('existing CTM fallback follows corrected takeoff',async()=>{
  const {data}=await apply({airline:'CTM',atd:'02:49',atdSource:'DERIVED:CTM_TAKEOFF',takeoff:'02:50'});assert.equal(data.atd,'02:50');
});
test('confirmed gate ATD upgrades fallback including equal times',async()=>{
  for(const value of ['02:40','02:49']){
    const {data}=await apply({airline:'CTM',takeoff:'02:49',atd:'02:49',atdSource:'DERIVED:CTM_TAKEOFF',atdDerived:true,atdDerivedFrom:'takeoff',atdDerivationMinutes:0},[{field:'atd',chosen_value:value,state:'CONFIRMED',source:'FLIGHTAWARE'}]);
    assert.equal(data.atd,value);assert.equal(data.atdSource,'PUBLIC_WEB_V4:FLIGHTAWARE');assert.equal(data.atdDerived,false);assert.equal(data.atdDerivedFrom,undefined);
  }
});
