import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
test("seuil de fraîcheur Gatenavo : 30 min", () => {
  const s=fs.readFileSync(new URL("./paris-airport-status-flow.js",import.meta.url),"utf8");
  assert.match(s,/const GATENAVO_MAX_AGE_MIN=30;/);
  assert.match(s,/<GATENAVO_MAX_AGE_MIN\*60000/);
});
