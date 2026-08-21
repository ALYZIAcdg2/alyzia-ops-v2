import test from "node:test";
import assert from "node:assert/strict";

import { parseSqEditing } from "../../src/parsers/sq/parseSqEditing.js";
import { createSqEditingFixture } from "../fixtures/sqEditingFixture.js";

test("SQ parser builds a canonical model only with an explicit reliable year", () => {
  const result = parseSqEditing({
    source_text: createSqEditingFixture(),
    options: { service_year: 2026 },
  });

  assert.equal(result.can_import, true);
  assert.equal(result.model.flight.flight_id, "SQ-335-20260819-CDG-SIN");
  assert.equal(result.model.flight.service_date_raw, "19AUG");
  assert.equal(result.model.flight.service_date_internal, "2026-08-19");
  assert.equal(result.model.timings.std, "12:30");
  assert.equal(result.model.timings.etd, "12:45");
  assert.equal(result.model.load.booked[0].value, 0);
  assert.equal(result.model.load.accepted[0].value, null);
  assert.equal(result.model.passengers[1].passenger_type, "INF");
  assert.equal(result.model.passengers[1].parent_ref, undefined);
});

test("SQ parser groups duplicate-category SSRs while retaining exact code counts", () => {
  const { model } = parseSqEditing({
    source_text: createSqEditingFixture(),
    options: { service_year: 2026 },
  });
  const prm = model.particularities.find((item) => item.category === "PRM");
  const other = model.particularities.find((item) => item.category === "OTHER");
  const meal = model.particularities.find((item) => item.category === "MEAL");

  assert.equal(prm.pax_count, 1);
  assert.deepEqual(prm.codes, [
    { code: "WCHR", count: 1 },
    { code: "WCHS", count: 1 },
  ]);
  assert.deepEqual(prm.passenger_ids, ["P1"]);
  assert.deepEqual(other.codes, [{ code: "FIXTURE_UNKNOWN", count: 1 }]);
  assert.equal(meal.codes[0].code, "FIXTURE_MEAL");
});

test("SQ parser classifies documents only from explicit source context", () => {
  const { model } = parseSqEditing({
    source_text: createSqEditingFixture(),
    options: { service_year: 2026 },
  });

  assert.deepEqual(model.tickets_documents.etkt[0], {
    number: "FIXTURE-ETKT-001",
    passenger_id: "P1",
  });
  assert.equal(model.tickets_documents.emds[0].number, "FIXTURE-EMD-001");
  assert.equal(model.tickets_documents.emds[0].associated_code, "WCHR");
  assert.deepEqual(model.tickets_documents.unclassified[0], {
    document_value: "FIXTURE-AMBIGUOUS-001",
    passenger_id: "P2",
    document_hint: "FIXTURE",
  });
});

test("SQ parser blocks an ambiguous day-month date instead of inventing a year", () => {
  const result = parseSqEditing({ source_text: createSqEditingFixture() });

  assert.equal(result.can_import, false);
  assert.equal(result.model.flight.service_date_raw, "19AUG");
  assert.equal(result.model.flight.service_date_internal, undefined);
  assert.ok(result.issues.some((issue) => issue.issue_code === "DATE_AMBIGUOUS"));
});

test("SQ parser does not derive status, ETD, availability or infant parent", () => {
  const source = [
    "SQ335/19AUG CDGSIN",
    "MOVEMENT: DEPARTURE",
    "STD: 0900",
    "PAX P1 | FIXTURE/INFANT02 | INF | TEST | TEST |",
  ].join("\n");
  const { model } = parseSqEditing({
    source_text: source,
    options: { service_year: 2026 },
  });

  assert.equal(model.timings.std, "09:00");
  assert.equal(Object.hasOwn(model.timings, "etd"), false);
  assert.equal(Object.hasOwn(model.timings, "flight_status"), false);
  assert.equal(Object.hasOwn(model.load, "availability"), false);
  assert.equal(Object.hasOwn(model.passengers[0], "parent_ref"), false);
});

test("SQ parser reports unparsed source lines without copying their content", () => {
  const result = parseSqEditing({
    source_text: createSqEditingFixture(),
    options: { service_year: 2026 },
  });
  const issue = result.issues.find(
    (item) => item.issue_code === "SQ_SOURCE_LINES_UNPARSED",
  );

  assert.deepEqual(issue.incoming_value, [26]);
  assert.doesNotMatch(issue.message, /UNMAPPED FIXTURE LINE/u);
});
