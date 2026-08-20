import test from "node:test";
import assert from "node:assert/strict";

import {
  DATE_ISSUE_CODES,
  parseDayMonth,
  resolveServiceDateInternal,
} from "../../src/utils/dateUtils.js";
import {
  durationToMinutes,
  isValidTime,
  normalizeDuration,
  normalizeTime,
} from "../../src/utils/timeUtils.js";

test("dateUtils parses 19AUG but does not invent a year", () => {
  assert.deepEqual(parseDayMonth("19AUG"), {
    day: 19,
    month: 8,
    month_code: "AUG",
  });

  assert.deepEqual(resolveServiceDateInternal("19AUG"), {
    service_date_raw: "19AUG",
    service_date_internal: null,
    issue_code: DATE_ISSUE_CODES.AMBIGUOUS,
  });
});

test("dateUtils preserves raw source and resolves only with an explicit year", () => {
  assert.deepEqual(resolveServiceDateInternal("19AUG", { year: 2026 }), {
    service_date_raw: "19AUG",
    service_date_internal: "2026-08-19",
    issue_code: null,
  });

  const invalid = resolveServiceDateInternal("31FEB", { year: 2026 });
  assert.equal(invalid.service_date_raw, "31FEB");
  assert.equal(invalid.issue_code, DATE_ISSUE_CODES.INVALID);
});

test("timeUtils normalizes clock time without deriving a flight status", () => {
  assert.equal(normalizeTime("0830"), "08:30");
  assert.equal(normalizeTime("8:30"), "08:30");
  assert.equal(isValidTime("23:59"), true);
  assert.equal(isValidTime("24:00"), false);
  assert.throws(() => normalizeTime("2400"), RangeError);
});

test("durations are handled separately and may exceed 23 hours", () => {
  assert.equal(normalizeDuration("2530"), "25:30");
  assert.equal(durationToMinutes("01:45"), 105);
  assert.throws(() => normalizeDuration("01:75"), RangeError);
});
