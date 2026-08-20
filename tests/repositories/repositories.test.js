import test from "node:test";
import assert from "node:assert/strict";

import { createFlightRepository } from "../../src/database/flightRepository.js";
import { createTimingRepository } from "../../src/database/timingRepository.js";
import { createD1Mock } from "./d1Mock.js";

test("flightRepository uses a prepared exact lookup", async () => {
  const fixture = { id: "SQ-335-20260819-CDG-SIN" };
  const { db, calls } = createD1Mock({ first: [fixture] });
  const repository = createFlightRepository(db);

  const result = await repository.findExact({
    airline: "SQ",
    flight_number: "335",
    service_date_internal: "2026-08-19",
    origin: "CDG",
    destination: "SIN",
  });

  assert.deepEqual(result, fixture);
  assert.match(calls[0].sql, /airline = \?1/u);
  assert.deepEqual(calls[0].values, [
    "SQ",
    "335",
    "2026-08-19",
    "CDG",
    "SIN",
  ]);
});

test("repository writes preserve zero and null as distinct bind values", async () => {
  const { db, calls } = createD1Mock();
  const repository = createTimingRepository(db);

  await repository.updateField("FLIGHT-FIXTURE", "etd", 0);
  await repository.updateField("FLIGHT-FIXTURE", "etd", null);

  assert.deepEqual(calls[0].values, [0, "FLIGHT-FIXTURE"]);
  assert.deepEqual(calls[1].values, [null, "FLIGHT-FIXTURE"]);
});

test("dynamic repository fields are protected by strict whitelists", async () => {
  const { db } = createD1Mock();
  const repository = createTimingRepository(db);

  await assert.rejects(
    repository.updateField(
      "FLIGHT-FIXTURE",
      "flight_status = 'DEPARTED' --",
      "SCHEDULED",
    ),
    /unsupported repository field/u,
  );
});

test("flightRepository rejects non-persistent create fields", () => {
  const { db } = createD1Mock();
  const repository = createFlightRepository(db);

  assert.throws(
    () =>
      repository.create({
        flight_id: "FLIGHT-FIXTURE",
        airline: "ZZ",
        codeshare: "ZZ999",
      }),
    /unsupported repository fields/u,
  );
});
