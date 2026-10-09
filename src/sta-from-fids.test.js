import test from "node:test";
import assert from "node:assert/strict";
import {staFromRow} from "./fids-atd-sweep.js";
test("STA lue dans le flux FIDS", () => {
  assert.equal(staFromRow({arr_time:"2026-10-08 09:25"}),"09:25");
  assert.equal(staFromRow({arr_time:"2026-10-08 09:25",dep_time_ts:1000,arr_time_ts:1000+140*60}),"09:25");
  assert.equal(staFromRow({arr_time:"2026-10-08 09:25",dep_time_ts:1000,arr_time_ts:1000+5*60}),"");   // durée absurde
  assert.equal(staFromRow({}),"");
});
