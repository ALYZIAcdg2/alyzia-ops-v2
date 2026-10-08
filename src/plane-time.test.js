import test from "node:test";
import assert from "node:assert/strict";
import {REFERENCE_LIST_RENDERER,REFERENCE_LIST_STYLE} from "./flight-list-reference-ui.js";
const src=REFERENCE_LIST_RENDERER.match(/function opsPlaneTime[\s\S]*?\n}\n/)[0];
const mk=()=>new Function(`
 const up=v=>String(v||'').toUpperCase();
 const opsClockMin=v=>{const m=/^(\\d\\d):(\\d\\d)$/.exec(v||'');return m?+m[1]*60+ +m[2]:null};
 const opsDate=()=>'2026-10-08';
 const opsLocalUtc=(d,t,code,day=0)=>!t?null:Date.UTC(2026,9,8,+t.slice(0,2),+t.slice(3))+day*86400000;
 const opsMinutes=n=>Math.floor(n/60)+'h '+String(Math.floor(n%60)).padStart(2,'0')+'m';
 ${src}
 return opsPlaneTime;`)();
test("temps de vol sous l'avion : prévu avant décollage, restant en vol, rien après",()=>{
  const f=mk(),x={};
  assert.equal(f(x,{std:"10:00",atd:"10:05",eta:"12:00"},{main:"PARTI"}),"1h 55m");        // ATD → ETA
  assert.equal(f(x,{std:"10:00",etd:"10:20",sta:"12:00"},{main:"RETARDÉ"}),"1h 40m");       // ETD → STA
  assert.equal(f(x,{std:"10:00",takeoff:"10:10",eta:"12:00"},{main:"EN VOL",remain:"Arrivée dans 1h 12m"}),"1h 12m");
  assert.equal(f(x,{std:"10:00",takeoff:"10:10",eta:"12:00"},{main:"EN VOL",remain:""}),"");
  assert.equal(f(x,{std:"10:00",atd:"10:05",eta:"12:00",landing:"11:50"},{main:"ATTERRI"}),"");
  assert.equal(f(x,{std:"10:00"},{main:"PRÉVU"}),"");                                      // pas d'arrivée connue
});
test("sous l'avion : affichage branché dans la ligne de trajet",()=>{
  assert.match(REFERENCE_LIST_RENDERER,/ops-plane-time/);
  assert.match(REFERENCE_LIST_STYLE,/\.ops-plane-time\{/);
  assert.doesNotThrow(()=>new Function(REFERENCE_LIST_RENDERER));
});
