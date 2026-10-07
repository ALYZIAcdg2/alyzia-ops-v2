import test from "node:test";
import assert from "node:assert/strict";
import {ADMIN_REORG_UI} from "./admin-reorg.js";
test("réorganisation admin : script valide, menu OUTILS et pastilles compactes",()=>{
  const js=/<script[^>]*>([\s\S]*)<\/script>/.exec(ADMIN_REORG_UI)[1];
  assert.doesNotThrow(()=>new Function(js));
  assert.match(js,/OUTILS/);assert.match(js,/adx-srcbtn/);assert.match(js,/adminRegRestoreBtn/);assert.match(js,/adn-v4-btn\.reset/);
  assert.match(ADMIN_REORG_UI,/\.adx-health:not\(\.adx-health-copy\)/);   // la copie de la page SOURCES PUBLIQUES garde son détail complet
});

test("boutons du menu OUTILS : style uniforme imposé en ligne, bouton OUTILS au gabarit d'ACTUALISER",()=>{
  assert.match(ADMIN_REORG_UI,/setProperty\(k,UNIFORM\[k\],'important'\)/);
  assert.match(ADMIN_REORG_UI,/getComputedStyle\(ref\)/);
  assert.doesNotMatch(ADMIN_REORG_UI,/font:900 14px\/1\.2 inherit/);   // raccourci invalide ignoré par le navigateur
});

test("pastilles de sources : une ligne, date du bilan = date du tableau, placées sous les cartes KPI",()=>{
  assert.match(ADMIN_REORG_UI,/flex-wrap:nowrap;overflow:hidden/);       // une seule ligne
  assert.match(ADMIN_REORG_UI,/text-overflow:ellipsis/);                 // jamais de retour à la ligne : « … » + détail dans l'infobulle / DÉTAIL
  assert.match(ADMIN_REORG_UI,/adx-health-toggle/);                      // bouton DÉTAIL conservé
});

test("ADMIN > OUTILS : « RELIRE UN VOL » (choix, aperçu sans écriture, confirmation, application) et plus de bouton dans la fiche vol",async()=>{
  const {readFileSync}=await import("node:fs");
  const js=/<script[^>]*>([\s\S]*)<\/script>/.exec(ADMIN_REORG_UI)[1];
  assert.match(js,/adminReadOneBtn/);assert.match(js,/RELIRE UN VOL/);
  assert.match(js,/\/api\/admin\/live-one'\+q,\{cache:'no-store'\}/);            // aperçu : GET (lecture seule)
  assert.match(js,/\/api\/admin\/live-one'\+q,\{method:'POST'/);                  // application : POST
  assert.match(js,/window\.alzModal/);
  const etd=readFileSync(new URL("./v2-etd-public-wrapper.js",import.meta.url),"utf8");
  assert.equal(etd.includes("READ_ONE_UI"),false);assert.equal(etd.includes("read-one-btn"),false);
  assert.match(etd,/window\.alzModal=appModal/);
});
