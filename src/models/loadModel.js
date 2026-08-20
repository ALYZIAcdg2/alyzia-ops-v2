import { copyArray, copyOwnFields } from "./modelUtils.js";

export const LOAD_TYPES = Object.freeze([
  "BOOKED",
  "ACCEPTED",
  "AVAILABILITY",
  "STANDBY",
]);

export const LOAD_TOTAL_METRICS = Object.freeze([
  "BOOKED_INFANTS",
  "ACCEPTED_INFANTS",
]);

const CLASS_BLOCKS = Object.freeze([
  "booked",
  "accepted",
  "availability",
  "standby",
]);

const TOTAL_FIELDS = Object.freeze(["booked_infants", "accepted_infants"]);

function createClassValues(values, fieldName) {
  return copyArray(values, fieldName).map((entry) =>
    copyOwnFields(entry, ["class", "value"]),
  );
}

export function createLoadModel(input = {}) {
  const model = copyOwnFields(input, TOTAL_FIELDS);

  for (const field of CLASS_BLOCKS) {
    if (Object.hasOwn(input, field)) {
      model[field] = createClassValues(input[field], field);
    }
  }

  return model;
}
