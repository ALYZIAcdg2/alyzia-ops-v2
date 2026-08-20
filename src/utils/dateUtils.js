const MONTHS = Object.freeze({
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
});

export const DATE_ISSUE_CODES = Object.freeze({
  AMBIGUOUS: "DATE_AMBIGUOUS",
  INVALID: "DATE_INVALID",
  MISSING: "DATE_MISSING",
});

export function preserveServiceDateRaw(value) {
  return value;
}

export function parseDayMonth(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d{1,2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/u.exec(
    value.trim().toUpperCase(),
  );

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const monthCode = match[2];
  const month = MONTHS[monthCode];
  const maximumDay = new Date(Date.UTC(2024, month, 0)).getUTCDate();

  if (day < 1 || day > maximumDay) {
    return null;
  }

  return { day, month, month_code: monthCode };
}

export function isValidIsoDate(value) {
  if (typeof value !== "string") {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function resolveServiceDateInternal(rawValue, { year } = {}) {
  const serviceDateRaw = preserveServiceDateRaw(rawValue);

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return {
      service_date_raw: serviceDateRaw,
      service_date_internal: undefined,
      issue_code: DATE_ISSUE_CODES.MISSING,
    };
  }

  if (isValidIsoDate(rawValue)) {
    return {
      service_date_raw: serviceDateRaw,
      service_date_internal: rawValue,
      issue_code: null,
    };
  }

  const parsed = parseDayMonth(rawValue);
  if (!parsed) {
    return {
      service_date_raw: serviceDateRaw,
      service_date_internal: null,
      issue_code: DATE_ISSUE_CODES.INVALID,
    };
  }

  if (!Number.isInteger(year)) {
    return {
      service_date_raw: serviceDateRaw,
      service_date_internal: null,
      issue_code: DATE_ISSUE_CODES.AMBIGUOUS,
    };
  }

  const month = String(parsed.month).padStart(2, "0");
  const day = String(parsed.day).padStart(2, "0");
  const internal = `${String(year).padStart(4, "0")}-${month}-${day}`;

  if (!isValidIsoDate(internal)) {
    return {
      service_date_raw: serviceDateRaw,
      service_date_internal: null,
      issue_code: DATE_ISSUE_CODES.INVALID,
    };
  }

  return {
    service_date_raw: serviceDateRaw,
    service_date_internal: internal,
    issue_code: null,
  };
}
