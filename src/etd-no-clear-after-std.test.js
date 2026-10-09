import test from "node:test";
import assert from "node:assert/strict";
import {stdAlreadyPassed} from "./fr24-board-sweep.js";
import fs from "node:fs";
test("STD dépassée (heure de Paris)", () => {
  const now=Date.parse("2026-10-08T11:31:00Z");   // 13:31 à Paris
  assert.equal(stdAlreadyPassed("13:05",now),true);
  assert.equal(stdAlreadyPassed("13:45",now),false);
  assert.equal(stdAlreadyPassed("",now),false);
});
test("l'ETD du tableau n'est plus effacé quand la STD est dépassée", () => {
  const s=fs.readFileSync(new URL("./fr24-board-sweep.js",import.meta.url),"utf8");
  assert.match(s,/cur!==std&&\/FR24BOARD\/\.test\(upper\(x\.etdSource\)\)&&!\(rowDate<date\|\|stdAlreadyPassed\(std,nowMs\)\)/);
});
