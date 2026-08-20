import test from "node:test";
import assert from "node:assert/strict";

import {
  compareCollections,
  compareField,
  strictValueEqual,
  valueState,
} from "../../src/utils/comparisonUtils.js";
import {
  compareOverrideValues,
  evaluateActiveOverrides,
} from "../../src/utils/overrideUtils.js";
import { canRemoveMissingValue } from "../../src/utils/scopeUtils.js";

test("comparison keeps undefined, null and zero distinct", () => {
  assert.equal(strictValueEqual(undefined, null), false);
  assert.equal(strictValueEqual(null, 0), false);
  assert.equal(strictValueEqual(undefined, 0), false);
  assert.equal(valueState(undefined), "UNDEFINED");
  assert.equal(valueState(null), "NULL");
  assert.equal(valueState(0), "ZERO");
  assert.equal(valueState(undefined, { present: false }), "ABSENT");

  assert.deepEqual(compareField({}, { load: undefined }, "load"), {
    equal: false,
    current_state: "ABSENT",
    incoming_state: "UNDEFINED",
    current_value: undefined,
    incoming_value: undefined,
  });
});

test("stable collection comparison is order-independent and key-aware", () => {
  const left = [
    { class: "Y", value: 0 },
    { class: "J", value: null },
  ];
  const right = [...left].reverse();

  assert.equal(compareCollections(left, right), true);
  assert.equal(compareCollections(left, [{ class: "Y", value: null }]), false);
});

test("FULL alone is insufficient to authorize a removal", () => {
  assert.deepEqual(
    canRemoveMissingValue({
      data_scope: "FULL",
      block_scope: "FULL",
      block_reliability: false,
      block_present: true,
    }),
    { allowed: false, reason: "BLOCK_NOT_RELIABLE" },
  );

  assert.deepEqual(
    canRemoveMissingValue({
      data_scope: "FULL",
      block_scope: "FULL",
      block_reliability: true,
      block_present: true,
      protected_value: true,
    }),
    { allowed: false, reason: "VALUE_PROTECTED" },
  );

  assert.deepEqual(
    canRemoveMissingValue({
      data_scope: "FULL",
      block_scope: "FULL",
      block_reliability: true,
      block_present: true,
    }),
    { allowed: true, reason: "RELIABLE_FULL_BLOCK" },
  );
});

test("override comparison reports SAME_VALUE and CONFLICT", () => {
  assert.equal(compareOverrideValues(0, 0), "SAME_VALUE");
  assert.equal(compareOverrideValues(null, 0), "CONFLICT");

  assert.equal(
    evaluateActiveOverrides({
      activeOverrides: [{ new_value: "LOCKED FIXTURE" }],
      incomingValue: "OTHER FIXTURE",
    }).state,
    "CONFLICT",
  );
  assert.equal(
    evaluateActiveOverrides({
      activeOverrides: [{}, {}],
      incomingValue: null,
    }).state,
    "MULTIPLE_ACTIVE_OVERRIDES",
  );
});
