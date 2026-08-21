import test from "node:test";
import assert from "node:assert/strict";

import { parseSqEditing } from "../../src/parsers/sq/parseSqEditing.js";
import {
  createSq337EditingFixture,
  createSqEditingFixture,
} from "../fixtures/sqEditingFixture.js";

const REFERENCE_CASES = Object.freeze([
  {
    label: "SQ335 fixture grammar",
    source: createSqEditingFixture,
    expectedId: "SQ-335-20260819-CDG-SIN",
    expectedRawDate: "19AUG",
  },
  {
    label: "SQ337 fixture grammar",
    source: createSq337EditingFixture,
    expectedId: "SQ-337-20260820-CDG-SIN",
    expectedRawDate: "20AUG",
  },
]);

for (const reference of REFERENCE_CASES) {
  test(`${reference.label} produces a reliable canonical identity`, () => {
    const result = parseSqEditing({
      source_text: reference.source(),
      options: { service_year: 2026 },
    });

    assert.equal(result.can_import, true);
    assert.equal(result.model.flight.flight_id, reference.expectedId);
    assert.equal(result.model.flight.service_date_raw, reference.expectedRawDate);
    assert.equal(result.model.flight.movement_type, "DEPARTURE");
  });
}

test("SQ337 fixture keeps repeated PRM SSR detail and unique passenger counts", () => {
  const { model } = parseSqEditing({
    source_text: createSq337EditingFixture(),
    options: { service_year: 2026 },
  });
  const prm = model.particularities.find((item) => item.category === "PRM");

  assert.equal(prm.pax_count, 2);
  assert.deepEqual(prm.passenger_ids, ["P1", "P2"]);
  assert.deepEqual(prm.codes, [
    { code: "WCHR", count: 2 },
    { code: "WCHS", count: 1 },
    { code: "BLND", count: 1 },
  ]);
});

test("SQ335 and SQ337 fixtures never merge flight identities or passengers", () => {
  const sq335 = parseSqEditing({
    source_text: createSqEditingFixture(),
    options: { service_year: 2026 },
  }).model;
  const sq337 = parseSqEditing({
    source_text: createSq337EditingFixture(),
    options: { service_year: 2026 },
  }).model;

  assert.notEqual(sq335.flight.flight_id, sq337.flight.flight_id);
  assert.equal(sq335.passengers.length, 2);
  assert.equal(sq337.passengers.length, 3);
  assert.equal(
    sq337.particularities.find((item) => item.category === "OTHER").codes[0].code,
    "FIXTURE_UNMAPPED_337",
  );
  assert.equal(sq337.tickets_documents.unclassified.length, 1);
});
