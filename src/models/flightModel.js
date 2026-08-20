import { assertAllowedValue, copyOwnFields } from "./modelUtils.js";

export const MOVEMENT_TYPES = Object.freeze(["DEPARTURE", "ARRIVAL"]);

const FLIGHT_FIELDS = Object.freeze([
  "airline",
  "flight_number",
  "service_date_raw",
  "service_date_internal",
  "origin",
  "destination",
  "movement_type",
  "flight_id",
]);

export function createFlightModel(input = {}) {
  assertAllowedValue(input.movement_type, MOVEMENT_TYPES, "movement_type");
  return copyOwnFields(input, FLIGHT_FIELDS);
}
