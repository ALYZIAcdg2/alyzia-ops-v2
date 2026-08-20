export function normalizeSeat(value) {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== "string") {
    throw new TypeError("seat must be a string");
  }

  return value.trim().toUpperCase().replace(/\s+/gu, "");
}

export default normalizeSeat;
