export const SQ_PARSER_NAME = "sq-editing";
export const SQ_PARSER_VERSION = "0.1.0";

export const SQ_FLIGHT_STATUSES = Object.freeze([
  "SCHEDULED",
  "DELAYED",
  "DEPARTED",
  "CANCELLED",
]);

export const SQ_ACCEPTANCE_STATUSES = Object.freeze([
  "NOT_OPEN",
  "OPEN",
  "CLOSED",
  "UNKNOWN",
]);

export const SQ_MOVEMENT_TYPES = Object.freeze(["DEPARTURE", "ARRIVAL"]);

export const SQ_MAX_SOURCE_CHARACTERS = 400_000;
