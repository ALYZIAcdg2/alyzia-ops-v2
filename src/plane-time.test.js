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
test("carte liste : STD / STA saisis à la main dans la fiche ne sont pas écrasés par la donnée distante",()=>{
  const src=REFERENCE_LIST_RENDERER.match(/function opsFlightForRow[\s\S]*?\n}\n/)[0];
  const run=(local,remote)=>new Function("row","opsLocalFlights","live","txt","up","keyFlight",`${src};return opsFlightForRow(row)`)(
    {getAttribute:()=>"openFlightFromHomeList(0)"},()=>[local],[remote],v=>String(v??""),v=>String(v??"").toUpperCase(),x=>x.flight).x;
  const base={flight:"AF1",activeDate:"2026-10-08",dep:"CDG",dest:"NCE"};
  const man=(t)=>({enrichment:{fields:{std:{source:"MANUAL",updated_at:t},sta:{source:"MANUAL",updated_at:t}}}});
  let x=run({...base,std:"07:20",sta:"09:00",...man("2026-10-08T10:00:00Z")},{...base,std:"06:00",sta:"08:00"});
  assert.equal(x.std,"07:20");assert.equal(x.sta,"09:00");
  x=run({...base,std:"07:20",sta:"09:00"},{...base,std:"06:00",sta:"08:00"});          // sans saisie manuelle : la donnée distante gagne
  assert.equal(x.std,"06:00");
  x=run({...base,std:"07:20",...man("2026-10-08T10:00:00Z")},{...base,std:"07:45",enrichment:{fields:{std:{source:"MANUAL",updated_at:"2026-10-08T11:00:00Z"}}}});
  assert.equal(x.std,"07:45");                                                          // saisie distante plus récente
});

test("temps écoulé / restant sous le temps de l'avion : jamais à la même hauteur (pas de chevauchement)",async()=>{
  const {readFileSync}=await import("node:fs");
  const s=readFileSync(new URL("./flight-list-reference-ui.js",import.meta.url),"utf8");
  const plane=Number(/\.ops-plane-time\{[^}]*top:calc\(50% \+ (\d+)px\)/.exec(s)[1]),el=Number(/\.ops-time-elapsed,#app \.ops-time-remaining\{position:absolute;top:calc\(50% \+ (\d+)px\)/.exec(s)[1]);
  assert.ok(el>=plane+16,"elapsed "+el+" / plane "+plane);
});
