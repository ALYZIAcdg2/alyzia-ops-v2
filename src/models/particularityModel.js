import { copyArray, copyOwnFields } from "./modelUtils.js";

export const PARTICULARITY_CATEGORIES = Object.freeze([
  "PRM",
  "UM",
  "ASSISTANCE",
  "PPS_SOLITAIRE",
  "ELITE",
  "VIP_PARTICULAR",
  "ANIMAL",
  "STAFF",
  "CHILD",
  "MEAL",
  "INFANT",
  "OTHER",
]);

export function createParticularityModel(input = {}) {
  const model = copyOwnFields(input, ["category", "pax_count"]);
  const codes = Object.hasOwn(input, "codes") ? input.codes : [];
  const passengerIds = Object.hasOwn(input, "passenger_ids")
    ? input.passenger_ids
    : [];

  model.codes = copyArray(codes, "codes").map((entry) =>
    copyOwnFields(entry, ["code", "count"]),
  );
  model.passenger_ids = copyArray(passengerIds, "passenger_ids");

  return model;
}
