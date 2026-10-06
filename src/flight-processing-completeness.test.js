import test from 'node:test';
import assert from 'node:assert/strict';
import {classify} from './admin-dashboard-native-wrapper.js';
import {flightOperationalStatus} from './flight-operational-status.js';
const now={date:'2026-10-02',hhmm:'04:15'};
const row=(x,date='2026-10-01')=>classify({row:{flight_date:date,flight_number:x.flight||'NH216'},x:{std:'19:20',sta:'15:55',...x}},now);
test('yesterday departed without ATA remains EN ATTENTE',()=>{
 const r=row({atd:'19:15',status:'DECOLLE'});assert.equal(r.state,'EN ATTENTE');assert.equal(r.flightStatus,'EN VOL');assert.ok(r.missing.includes('ATA'));
});
test('today ETA passed does not close missing ATA',()=>{
 const r=row({std:'00:10',sta:'01:00',atd:'00:15',status:'DECOLLE'},now.date);assert.equal(r.state,'EN ATTENTE');assert.ok(r.missing.includes('ATA'));
});
test('missing STA keeps arrived flight partial',()=>{
 const r=row({sta:'',atd:'19:15',ata:'02:10'});assert.equal(r.state,'EN ATTENTE');assert.deepEqual(r.missing,['STA']);
});
test('actual ATA closes complete timing record; cancellation is final',()=>{
 assert.equal(row({atd:'19:15',ata:'02:10'}).state,'OK');assert.equal(row({status:'CANCELLED',sta:''}).state,'OK');
});
test('scheduled arrival alone never proves arrival',()=>{
 const r=row({std:'00:10',sta:'01:00',status:'PRÉVU'},now.date);assert.equal(r.state,'À CONTRÔLER');assert.equal(r.flightStatus,'PRÉVU');
});
test('actual arrival beats stale departed and planned statuses',()=>{
 assert.equal(flightOperationalStatus({status:'DECOLLE',ata:'03:10'}),'ARRIVÉE');assert.equal(flightOperationalStatus({status:'PRÉVU',atd:'03:10'}),'EN VOL');assert.equal(flightOperationalStatus({status:'DECOLLE',takeoff:'03:15'}),'EN VOL');assert.equal(flightOperationalStatus({status:'ANNULÉ',cancelledSource:'FLIGHTSTATS',atd:'03:10'}),'ANNULÉ');assert.equal(flightOperationalStatus({status:'CANCELLED',atd:'03:10'}),'EN VOL');
});
test('future schedule needs no actual arrival',()=>{
 const r=row({},'2026-10-03');assert.equal(r.state,'OK');assert.equal(r.missing.includes('ATA'),false);
});
