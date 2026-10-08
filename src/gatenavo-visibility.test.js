import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const rd=f=>fs.readFileSync(new URL(f,import.meta.url),"utf8");
test("Gatenavo : pastille, bilan, sources publiques, journal et historique fiche", () => {
  assert.match(rd("./admin-ux-wrapper.js"),/\['GATENAVO','GN'/);
  assert.match(rd("./v2-admin-public-sources-wrapper.js"),/key:"GATENAVO"/);
  assert.match(rd("./paris-airport-status-flow.js"),/field:'boarding'/);
  assert.match(rd("./admin-dashboard-native-wrapper.js"),/s:"GATENAVO"/);
  assert.match(rd("./v2-ui-consistency-wrapper.js"),/STATUT · HISTORIQUE/);
});
