import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFlightId,
  compareFlightIdentity,
  parseFlightId,
  validateFlightId,
} from "../../src/utils/flightIdentityUtils.js";
import { normalizePassengerName } from "../../src/utils/normalizePassengerName.js";
import { normalizeSeat } from "../../src/utils/normalizeSeat.js";

const FIXTURE_IDENTITY = Object.freeze({
  airline: "SQ",
  flight_number: "335",
  service_date_internal: "2026-08-19",
  origin: "CDG",
  destination: "SIN",
});

test("buildFlightId creates the canonical identity", () => {
  assert.equal(
    buildFlightId(FIXTURE_IDENTITY),
    "SQ-335-20260819-CDG-SIN",
  );
});

test("validateFlightId validates the date and all five identity segments", () => {
  assert.equal(validateFlightId("SQ-335-20260819-CDG-SIN"), true);
  assert.equal(validateFlightId("SQ-335-20260230-CDG-SIN"), false);
  assert.equal(validateFlightId("SQ-335-20260819-CDG"), false);
  assert.deepEqual(parseFlightId("SQ-335-20260819-CDG-SIN"), FIXTURE_IDENTITY);
});

test("compareFlightIdentity accepts canonical IDs or identity objects", () => {
  assert.equal(
    compareFlightIdentity(FIXTURE_IDENTITY, "SQ-335-20260819-CDG-SIN"),
    true,
  );
  assert.equal(
    compareFlightIdentity(FIXTURE_IDENTITY, {
      ...FIXTURE_IDENTITY,
      destination: "TST",
    }),
    false,
  );
});

test("normalizePassengerName preserves accents and special characters", () => {
  assert.equal(
    normalizePassengerName("  Élise   Test-Fixture/Åke "),
    "ÉLISE TEST-FIXTURE/ÅKE",
  );
  assert.equal(normalizePassengerName(null), null);
});

test("normalizeSeat preserves leading zeros and removes internal spaces", () => {
  assert.equal(normalizeSeat("  07 a "), "07A");
  assert.equal(normalizeSeat(undefined), undefined);
});
