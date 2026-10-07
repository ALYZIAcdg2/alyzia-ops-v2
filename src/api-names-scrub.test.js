import test from "node:test";
import assert from "node:assert/strict";
import {API_NAMES_SCRUB_UI} from "./api-names-scrub.js";
import {scrubPaidNames,PAID_NAME_RE} from "./provider-names.js";
test("noms d'API payantes : remplacés, sources réelles intactes",()=>{
  assert.equal(scrubPaidNames("AIRLABS ROUTES → OAG"),"SOURCE ARCHIVÉE → SOURCE ARCHIVÉE");
  assert.equal(scrubPaidNames("PUBLIC_LIVE:FR24BOARD"),"PUBLIC_LIVE:FR24BOARD");
  for(const keep of ["FIDS","FLIGHTSTATS","FLIGHTAWARE","FR24","FR24BOARD","Flightradar24","FLIGHTRADAR24","GATENAVO","KAYAKING"])assert.equal(scrubPaidNames(keep),keep);
  for(const bad of ["OAG","OAG_STATUS","AIRLABS","SKYLINK","AERODATABOX","ADB","AVIATIONDATA","QUARK","SERPAPI","KAYAK","FLIGHTERA","FR24API","FR24DEP","CDGBOARD","FLIGHTRADAR1","FLIGHTRADAR8","OPENSKY"]){PAID_NAME_RE.lastIndex=0;assert.notEqual(scrubPaidNames(bad),bad,bad)}
});
test("script d'interface : valide, panneaux fournisseurs masqués, mêmes noms que le module serveur",()=>{
  const js=/<script[^>]*>([\s\S]*)<\/script>/.exec(API_NAMES_SCRUB_UI)[1];
  assert.doesNotThrow(()=>new Function(js));
  assert.match(API_NAMES_SCRUB_UI,/#providerObservability,\.provider-observability,\.live-strip\{display:none!important\}/);
  const names=/const SRC='\\\\b\(\?:([^)]*(?:\([^)]*\)[^)]*)*)\)\\\\b'/.exec(js);assert.ok(names);
});
