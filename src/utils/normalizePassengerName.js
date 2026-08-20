export function normalizePassengerName(value) {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== "string") {
    throw new TypeError("passenger name must be a string");
  }

  return value.trim().toUpperCase().replace(/\s+/gu, " ");
}

export default normalizePassengerName;
