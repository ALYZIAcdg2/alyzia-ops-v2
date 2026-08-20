import test from "node:test";
import assert from "node:assert/strict";

import { importFlightData } from "../../src/import/importFlightData.js";

const DB_FIXTURE = Object.freeze({
  prepare() {
    throw new Error("Lot 1 import must not execute D1 statements");
  },
});

test("Lot 1 import contract stops safely at REVIEW_REQUIRED", async () => {
  const result = await importFlightData({
    db: DB_FIXTURE,
    model: {},
    context: {
      import_id: "IMPORT-FIXTURE-1",
      import_mode: "MANUAL",
      data_scope: "PARTIAL",
      user_id: "USER-FIXTURE",
    },
  });

  assert.equal(result.status, "REVIEW_REQUIRED");
  assert.equal(result.phases.validation.status, "COMPLETED");
  assert.equal(result.phases.flight_matching.status, "PENDING");
  assert.deepEqual(result.plan.operations, []);
  assert.equal(result.issues[0].issue_code, "IMPORT_ENGINE_SCAFFOLD_ONLY");
});

test("invalid import context returns ERROR without executing changes", async () => {
  const result = await importFlightData({
    db: DB_FIXTURE,
    model: {},
    context: { import_id: "", import_mode: "UNSUPPORTED" },
  });

  assert.equal(result.status, "ERROR");
  assert.equal(result.phases.validation.status, "ERROR");
  assert.ok(result.issues.every((issue) => issue.severity === "BLOCKING"));
});
