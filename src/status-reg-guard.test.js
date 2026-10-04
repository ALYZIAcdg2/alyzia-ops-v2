import test from "node:test";
import assert from "node:assert/strict";
import {pickStatus,LIVE_PUBLIC_SOURCE_ORDER} from "./ops-public-live-flow-optimized.js";
import {isWebWordRegistration} from "./registration-guard.js";

test("a single source saying ANNULÉ is ignored",()=>{
  const map={FLIGHTSTATS:{status:"ANNULÉ"},FR24:{status:"EN VOL"}};
  assert.equal(pickStatus(map,LIVE_PUBLIC_SOURCE_ORDER.status).value,"EN VOL");
  assert.equal(pickStatus({SKYSCANNER:{status:"ANNULÉ"}},LIVE_PUBLIC_SOURCE_ORDER.status).value,"");
});
test("ANNULÉ is kept when two sources agree",()=>{
  const map={FR24:{status:"ANNULÉ"},FLIGHTSTATS:{status:"ANNULÉ"}};
  assert.equal(pickStatus(map,LIVE_PUBLIC_SOURCE_ORDER.status).value,"ANNULÉ");
});
test("ON-TIME is not a registration",()=>{
  assert.ok(isWebWordRegistration("ON-TIME"));
  assert.ok(!isWebWordRegistration("TS-IMX"));
  assert.ok(!isWebWordRegistration("EC-NCK"));
});
