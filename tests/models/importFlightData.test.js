import test from "node:test";
import assert from "node:assert/strict";

import { createHistoryRepository } from "../../src/database/historyRepository.js";
import { createImportRepository } from "../../src/database/importRepository.js";
import { createManualChangeRepository } from "../../src/database/manualChangeRepository.js";
import { importFlightData } from "../../src/import/importFlightData.js";
import { createLot2FlightFixture } from "../fixtures/lot2FlightFixture.js";
import { createSQLiteD1 } from "../repositories/sqliteD1.js";

function context(importId, overrides = {}) {
  return {
    import_id: importId,
    import_mode: "MANUAL",
    data_scope: "PARTIAL",
    user_id: "LOT3_TEST_USER",
    ...overrides,
  };
}

test("invalid import context returns ERROR without executing D1", async () => {
  const result = await importFlightData({
    db: {
      prepare() {
        throw new Error("D1 must not be called");
      },
    },
    model: createLot2FlightFixture(),
    context: { import_id: "", import_mode: "UNSUPPORTED" },
  });

  assert.equal(result.status, "ERROR");
  assert.equal(result.phases.validation.status, "ERROR");
  assert.ok(result.issues.some((issue) => issue.severity === "BLOCKING"));
});

test("invalid model is persisted as an ERROR import when context is valid", async () => {
  const database = createSQLiteD1();
  try {
    const result = await importFlightData({
      db: database.db,
      model: { flight: {} },
      context: context("IMPORT-INVALID-MODEL"),
    });
    const repository = createImportRepository(database.db);

    assert.equal(result.status, "ERROR");
    assert.equal((await repository.getImportById("IMPORT-INVALID-MODEL")).import_status, "ERROR");
    assert.equal((await repository.getIssuesByImportId("IMPORT-INVALID-MODEL"))[0].issue_code, "MODEL_CONTRACT_INVALID");
  } finally {
    database.close();
  }
});

test("structured import creates a new flight, source, history and PROCESSED status", async () => {
  const database = createSQLiteD1();
  try {
    const model = createLot2FlightFixture();
    const result = await importFlightData({
      db: database.db,
      model,
      context: context("IMPORT-NEW-1"),
    });

    assert.equal(result.status, "PROCESSED");
    assert.equal(result.flight.flight.flight_id, model.flight.flight_id);
    const repository = createImportRepository(database.db);
    assert.equal(
      (await repository.getImportById("IMPORT-NEW-1")).import_status,
      "PROCESSED",
    );
    assert.equal((await repository.getSourcesByImportId("IMPORT-NEW-1")).length, 1);
    const history = await createHistoryRepository(database.db).getByImportId(
      "IMPORT-NEW-1",
    );
    assert.equal(history.length, 1);
    assert.equal(history[0].change_action, "CREATE");
  } finally {
    database.close();
  }
});

test("replaying the same structured data with a new id returns NO_CHANGE", async () => {
  const database = createSQLiteD1();
  try {
    const model = createLot2FlightFixture();
    await importFlightData({ db: database.db, model, context: context("IMPORT-BASE") });
    const result = await importFlightData({
      db: database.db,
      model,
      context: context("IMPORT-NO-CHANGE"),
    });

    assert.equal(result.status, "NO_CHANGE");
    assert.deepEqual(result.differences, []);
    assert.deepEqual(result.plan.operations, []);
  } finally {
    database.close();
  }
});

test("movement type change requires review and is never silently applied", async () => {
  const database = createSQLiteD1();
  try {
    const initial = createLot2FlightFixture();
    await importFlightData({ db: database.db, model: initial, context: context("IMPORT-MOVEMENT-BASE") });
    const incoming = createLot2FlightFixture();
    incoming.flight.movement_type = "ARRIVAL";
    const result = await importFlightData({
      db: database.db,
      model: incoming,
      context: context("IMPORT-MOVEMENT-REVIEW"),
    });

    assert.equal(result.status, "REVIEW_REQUIRED");
    assert.ok(result.conflicts.some((item) => item.field_path === "flight.movement_type"));
  } finally {
    database.close();
  }
});

test("safe scalar and keyed load updates execute atomically with field history", async () => {
  const database = createSQLiteD1();
  try {
    const initial = createLot2FlightFixture();
    await importFlightData({
      db: database.db,
      model: initial,
      context: context("IMPORT-UPDATE-BASE"),
    });
    const incoming = createLot2FlightFixture();
    incoming.timings.etd = "09:15";
    incoming.load.booked.find(
      (item) => item.class === "STANDARD_FIXTURE",
    ).value = 12;

    const result = await importFlightData({
      db: database.db,
      model: incoming,
      context: context("IMPORT-UPDATE"),
    });

    assert.equal(result.status, "PROCESSED");
    assert.equal(result.flight.timings.etd, "09:15");
    assert.equal(
      result.flight.load.booked.find(
        (item) => item.class === "STANDARD_FIXTURE",
      ).value,
      12,
    );
    const history = await createHistoryRepository(database.db).getByImportId(
      "IMPORT-UPDATE",
    );
    assert.deepEqual(
      history.map((entry) => entry.field_path).sort(),
      ["load.booked[class=STANDARD_FIXTURE].value", "timings.etd"],
    );
  } finally {
    database.close();
  }
});

test("PARTIAL scope never removes an omitted keyed value", async () => {
  const database = createSQLiteD1();
  try {
    const initial = createLot2FlightFixture();
    await importFlightData({
      db: database.db,
      model: initial,
      context: context("IMPORT-PARTIAL-BASE"),
    });
    const incoming = createLot2FlightFixture();
    incoming.load.booked = incoming.load.booked.filter(
      (item) => item.class !== "STANDARD_FIXTURE",
    );
    const result = await importFlightData({
      db: database.db,
      model: incoming,
      context: context("IMPORT-PARTIAL"),
    });

    assert.equal(result.status, "NO_CHANGE");
    assert.ok(
      result.issues.some((issue) => issue.issue_code === "REMOVAL_NOT_AUTHORIZED"),
    );
  } finally {
    database.close();
  }
});

test("FULL reliable block permits an explicit keyed removal", async () => {
  const database = createSQLiteD1();
  try {
    const initial = createLot2FlightFixture();
    await importFlightData({
      db: database.db,
      model: initial,
      context: context("IMPORT-FULL-BASE"),
    });
    const incoming = createLot2FlightFixture();
    incoming.load.booked = incoming.load.booked.filter(
      (item) => item.class !== "STANDARD_FIXTURE",
    );
    const result = await importFlightData({
      db: database.db,
      model: incoming,
      context: context("IMPORT-FULL", {
        data_scope: "FULL",
        block_scopes: {
          "load.booked": {
            block_scope: "FULL",
            block_reliability: true,
            block_present: true,
          },
        },
      }),
    });

    assert.equal(result.status, "PROCESSED");
    assert.equal(
      result.flight.load.booked.some(
        (item) => item.class === "STANDARD_FIXTURE",
      ),
      false,
    );
  } finally {
    database.close();
  }
});

test("active manual override conflict protects the field and requires review", async () => {
  const database = createSQLiteD1();
  try {
    const initial = createLot2FlightFixture();
    await importFlightData({
      db: database.db,
      model: initial,
      context: context("IMPORT-OVERRIDE-BASE"),
    });
    await createManualChangeRepository(database.db).create({
      flight_id: initial.flight.flight_id,
      entity_type: "TIMING",
      field_path: "timings.etd",
      old_value: JSON.stringify(initial.timings.etd),
      new_value: JSON.stringify("10:00"),
      override_type: "LOCKED",
      active: 1,
      changed_by: "MANUAL_TEST_USER",
      reason: "Test protection",
    });
    const incoming = createLot2FlightFixture();
    incoming.timings.etd = "09:15";
    const result = await importFlightData({
      db: database.db,
      model: incoming,
      context: context("IMPORT-OVERRIDE"),
    });

    assert.equal(result.status, "REVIEW_REQUIRED");
    assert.equal(result.conflicts[0].reason, "CONFLICT");
    assert.equal(result.snapshot.timings.etd, initial.timings.etd);
  } finally {
    database.close();
  }
});

test("ambiguous structural change is never applied automatically", async () => {
  const database = createSQLiteD1();
  try {
    const initial = createLot2FlightFixture();
    await importFlightData({
      db: database.db,
      model: initial,
      context: context("IMPORT-STRUCTURE-BASE"),
    });
    const incoming = createLot2FlightFixture();
    incoming.passengers[0].remark = "MODIFICATION STRUCTURELLE TEST";
    incoming.timings.etd = "09:15";
    const result = await importFlightData({
      db: database.db,
      model: incoming,
      context: context("IMPORT-STRUCTURE"),
    });

    assert.equal(result.status, "REVIEW_REQUIRED");
    assert.ok(
      result.issues.some(
        (issue) => issue.issue_code === "STRUCTURAL_MATCHING_REQUIRED",
      ),
    );
    assert.equal(result.snapshot.timings.etd, initial.timings.etd);
  } finally {
    database.close();
  }
});

test("an import id cannot be replayed", async () => {
  const database = createSQLiteD1();
  try {
    const model = createLot2FlightFixture();
    await importFlightData({
      db: database.db,
      model,
      context: context("IMPORT-UNIQUE"),
    });
    const result = await importFlightData({
      db: database.db,
      model,
      context: context("IMPORT-UNIQUE"),
    });
    assert.equal(result.status, "ERROR");
    assert.ok(
      result.issues.some(
        (issue) => issue.issue_code === "IMPORT_ID_ALREADY_EXISTS",
      ),
    );
  } finally {
    database.close();
  }
});
