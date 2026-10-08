import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const rd=f=>fs.readFileSync(new URL(f,import.meta.url),"utf8");
test("cron : passage complet aux minutes paires, passage léger embarquement aux minutes impaires", () => {
  const w=rd("../wrangler.jsonc");
  assert.match(w,/"crons": \["\*\/2 \* \* \* \*", "1-59\/2 \* \* \* \*"\]/);
  const s=rd("./v2-etd-public-wrapper.js");
  assert.match(s,/const LIGHT_CRON="1-59\/2 \* \* \* \*"/);
  assert.match(s,/controller\?\.cron===LIGHT_CRON\)\{ctx\.waitUntil\(runBoardingOnly\(env\)\);return\}/);   // pas d'autre étape sur ce déclencheur
  assert.match(s,/async function runBoardingOnly[\s\S]*acquireCronLock[\s\S]*runParisAirportStatusFlow[\s\S]*releaseCronLock/);  // même verrou que le passage complet
});
