import {
  assertAllowedValue,
  copyArray,
  copyOwnFields,
} from "./modelUtils.js";

export const PASSENGER_TYPES = Object.freeze(["ADT", "CHLD", "INF"]);

const PASSENGER_FIELDS = Object.freeze([
  "id",
  "temp_id",
  "passenger_name_raw",
  "passenger_name_normalized",
  "passenger_type",
  "parent_passenger_id",
  "parent_ref",
  "cabin_class",
  "booking_class",
  "seat",
  "remark",
]);

const ARRAY_FIELDS = Object.freeze([
  "etkt",
  "emds",
  "codes",
  "connection_refs",
]);

export function createPassengerModel(input = {}) {
  assertAllowedValue(input.passenger_type, PASSENGER_TYPES, "passenger_type");

  const model = copyOwnFields(input, PASSENGER_FIELDS);

  for (const field of ARRAY_FIELDS) {
    model[field] = Object.hasOwn(input, field)
      ? copyArray(input[field], field)
      : [];
  }

  return model;
}
