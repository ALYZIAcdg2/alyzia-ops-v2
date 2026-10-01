import test from "node:test";
import assert from "node:assert/strict";
import {buildNeeds,flightComplete,mayWriteField,providerNeeded,stopAll,trackingCadenceMinutes} from "./flight-enrichment-policy.js";

test("un vol complet coupe tous les providers",()=>{
  const x={std:"10:00",sta:"12:00",duration:120,atd:"10:11",ata:"12:07",gate:"K45",reg:"9V-SWM",aircraft:"77W"};
  assert.equal(flightComplete(x),true);
  assert.equal(stopAll(x),true);
  assert.equal(providerNeeded("OAG_STATUS",x,-120),false);
  assert.equal(providerNeeded("AIRLABS",x,-120),false);
});

test("ATA confirmée déclenche STOP même si une donnée historique secondaire manque",()=>{
  const x={std:"10:00",sta:"12:00",atd:"10:11",ata:"12:07",gate:"",reg:"",aircraft:""};
  assert.equal(flightComplete(x),false);
  assert.equal(stopAll(x),true);
  assert.equal(buildNeeds(x,-130).any,false);
});

test("ETD et gate ne sont plus demandés après départ; ATA demandée seulement à l'approche de l'arrivée",()=>{
  const x={std:"10:00",sta:"12:00",duration:120,atd:"10:11",etd:"",gate:"",ata:"",reg:"9V-SWM",aircraft:"77W"};
  const airborne=buildNeeds(x,-30);
  assert.equal(airborne.etd,false);
  assert.equal(airborne.gate,false);
  assert.equal(airborne.ata,false);
  const approaching=buildNeeds(x,-100);
  assert.equal(approaching.ata,true);
  const landed=buildNeeds({...x,status:"LANDED"},-30);
  assert.equal(landed.ata,true);
});

test("un statut AIRBORNE ne coupe jamais la recherche ATD",()=>{
  const x={std:"10:00",sta:"12:00",duration:120,atd:"",ata:"",status:"AIRBORNE"};
  const n=buildNeeds(x,-180);
  assert.equal(n.atd,true);
  assert.equal(providerNeeded("OAG_STATUS",x,-180),true);
});

test("un statut ARRIVED sans ATA ne coupe jamais la recherche ATA",()=>{
  const x={std:"10:00",sta:"12:00",duration:120,atd:"10:11",ata:"",status:"ARRIVED"};
  const n=buildNeeds(x,-150);
  assert.equal(n.ata,true);
  assert.equal(stopAll(x),false);
  assert.equal(providerNeeded("SKYLINK",x,-150),true);
});

test("ATA est pilotée par l'arrivée estimée et non uniquement par STD",()=>{
  const x={std:"20:45",sta:"09:55",eta:"09:34",duration:670,atd:"20:56",ata:""};
  const n=buildNeeds(x,-390);
  assert.equal(n.ata,false);
  const nearArrival=buildNeeds(x,-620);
  assert.equal(nearArrival.ata,true);
});

test("OpenSky ne sert qu'autour du départ pour ATD ou immat",()=>{
  const x={std:"10:00",sta:"12:00",duration:120,atd:"",ata:"",gate:"K45",reg:""};
  assert.equal(providerNeeded("OPENSKY",x,10),true);
  assert.equal(providerNeeded("OPENSKY",x,300),false);
});

test("le type appareil est recherché comme champ autonome",()=>{
  const x={std:"10:00",sta:"12:00",gate:"A1",reg:"F-ABCD",aircraft:""};
  const n=buildNeeds(x,180);
  assert.equal(n.aircraft,true);
  assert.equal(providerNeeded("AIRLABS",x,180),true);
  assert.equal(providerNeeded("OAG_STATUS",x,180),true);
});

test("une valeur finale existante n'est pas écrasée",()=>{
  const x={atd:"10:11",atdSource:"OAG_STATUS"};
  assert.equal(mayWriteField(x,"atd","AIRLABS_LIVE_RECOVERY"),false);
  assert.equal(mayWriteField({aircraft:"77W"},"aircraft","AERODATABOX"),false);
});

test("ETA API peut évoluer avant ATA",()=>{
  const x={atd:"10:11",ata:"",eta:"12:00",etaSource:"OAG_STATUS"};
  assert.equal(mayWriteField(x,"eta","AIRLABS_LIVE_RECOVERY"),true);
});

test("ETD déjà connu : redemandé quand il date de plus de 30 min, pas avant",()=>{
  const recent=new Date(Date.now()-5*60000).toISOString(),old=new Date(Date.now()-40*60000).toISOString();
  const base={std:"10:00",sta:"12:00",gate:"A1",reg:"F-ABCD",aircraft:"320"};
  assert.equal(buildNeeds({...base},60).etd,true);
  assert.equal(buildNeeds({...base,etd:"10:30",etdUpdatedAt:recent},60).etd,false);
  assert.equal(buildNeeds({...base,etd:"10:30",etdUpdatedAt:old},60).etd,true);
  assert.equal(buildNeeds({...base,etd:"10:30"},60).etd,true);
  assert.equal(buildNeeds({...base,etd:"10:30",etdUpdatedAt:old},600).etd,false);
  assert.equal(buildNeeds({...base,atd:"10:10",etd:"10:30",etdUpdatedAt:old},-20).etd,false);
});

test("cadence V2 par phase de vol",()=>{
  const base={std:"18:00",sta:"20:00",aircraft:"320"};
  assert.equal(trackingCadenceMinutes(base,500),60);
  assert.equal(trackingCadenceMinutes(base,300),30);
  assert.equal(trackingCadenceMinutes(base,120),15);
  assert.equal(trackingCadenceMinutes(base,45),5);
  assert.equal(trackingCadenceMinutes({...base,atd:"18:07"},-20),15);
  assert.equal(trackingCadenceMinutes({...base,atd:"18:07",ata:"20:03"},-125),Infinity);
});
