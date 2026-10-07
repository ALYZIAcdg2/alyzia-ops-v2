import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("le bouton IMMAT d'administration est injecté et son script est valide",()=>{
  const src=readFileSync(new URL("./v2-etd-public-wrapper.js",import.meta.url),"utf8");
  const i=src.indexOf("const REG_RESTORE_UI=String.raw`")+"const REG_RESTORE_UI=String.raw`".length,j=src.indexOf("`;",i);
  const js=/<script[^>]*>([\s\S]*)<\/script>/.exec(src.slice(i,j))[1];
  assert.doesNotThrow(()=>new Function(js));
  assert.match(js,/\/api\/admin\/reg-restore/);assert.match(js,/method:'POST'/);assert.match(js,/appModal/);assert.doesNotMatch(js,/window\.confirm/);
  assert.match(src,/FICHE_CONFIG_UI\+'\\n'\+REG_RESTORE_UI/);
});
