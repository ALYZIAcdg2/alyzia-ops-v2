import { assertAllowedValue, copyOwnFields } from "./modelUtils.js";

export const FLIGHT_STATUSES = Object.freeze([
  "SCHEDULED",
  "DELAYED",
  "DEPARTED",
  "CANCELLED",
]);

export const ACCEPTANCE_STATUSES = Object.freeze([
  "NOT_OPEN",
  "OPEN",
  "CLOSED",
  "UNKNOWN",
]);

const TIMING_FIELDS = Object.freeze([
  "std",
  "etd",
  "atd",
  "boarding_time",
  "flight_status",
  "acceptance_status",
  "status_validated_at",
  "status_validated_by",
]);

export function createTimingModel(input = {}) {
  assertAllowedValue(input.flight_status, FLIGHT_STATUSES, "flight_status");
  assertAllowedValue(
    input.acceptance_status,
    ACCEPTANCE_STATUSES,
    "acceptance_status",
  );
  return copyOwnFields(input, TIMING_FIELDS);
}
