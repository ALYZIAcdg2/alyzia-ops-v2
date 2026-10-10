import test from "node:test";import assert from "node:assert/strict";
import {compositeKey,parseMyAirport,probeMyAirport} from "./myairport-probe.js";
test("clé de partage reconstituée comme sur le lien de TK1830",()=>{
  assert.equal(compositeKey({flight:"TK1830",date:"2026-10-10",destination:"IST"}),"20261010TK  1830CDG IST");
  assert.equal(compositeKey({flight:"nonsense",date:"2026-10-10"}),"");
});
test("« Décollé à 11:13 » lu ; rien de lu sans la mention",()=>{
  const p=parseMyAirport("<html><script>x=1</script><body>TK1830 <b>Décollé à 11:13</b> Enregistrement --</body></html>");
  assert.equal(p.takeoff,"11:13");assert.equal(p.landing,"");
  assert.equal(parseMyAirport("<p>TK1830 11:45 IST</p>").takeoff,"");
  assert.equal(parseMyAirport("<p>Posé à 14:02</p>").landing,"14:02");
});
const mk=(status,body)=>async()=>({status,headers:{get:()=>"text/html"},text:async()=>body});
test("sonde : lisible, protégée (arrêt), erreur HTTP — une seule requête, jamais d'écriture",async()=>{
  let n=0;const f=b=>async(...a)=>{n++;return mk(200,b)(...a)};
  const ok=await probeMyAirport({flight:"TK1830",date:"2026-10-10",destination:"IST"},{fetchImpl:f("<body>Décollé à 11:13</body>")});
  assert.equal(ok.takeoff,"11:13");assert.match(ok.verdict,/LISIBLE : décollage réel 11:13/);assert.equal(n,1);
  const bot=await probeMyAirport({flight:"TK1830",date:"2026-10-10",destination:"IST"},{fetchImpl:mk(200,"<h1>Pardon Our Interruption</h1>")});
  assert.equal(bot.botProtection,true);assert.match(bot.verdict,/PROTÉGÉE/);assert.equal(bot.takeoff,undefined);
  const e403=await probeMyAirport({flight:"TK1830",date:"2026-10-10",destination:"IST"},{fetchImpl:mk(403,"nope")});
  assert.match(e403.verdict,/HTTP 403/);
  assert.equal((await probeMyAirport({})).ok,false);
});
