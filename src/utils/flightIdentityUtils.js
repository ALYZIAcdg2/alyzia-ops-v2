import { isValidIsoDate } from "./dateUtils.js";

function normalizeIdentityToken(value, fieldName) {
  if (typeof value !== "string") {
    throw new TypeError(`${fieldName} must be a string`);
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized || normalized.includes("-")) {
    throw new RangeError(`${fieldName} is not a valid identity segment`);
  }

  return normalized;
}

export function buildFlightId({
  airline,
  flight_number,
  service_date_internal,
  origin,
  destination,
} = {}) {
  if (!isValidIsoDate(service_date_internal)) {
    throw new RangeError(
      "service_date_internal must be a reliable ISO date (YYYY-MM-DD)",
    );
  }

  const dateToken = service_date_internal.replaceAll("-", "");

  return [
    normalizeIdentityToken(airline, "airline"),
    normalizeIdentityToken(flight_number, "flight_number"),
    dateToken,
    normalizeIdentityToken(origin, "origin"),
    normalizeIdentityToken(destination, "destination"),
  ].join("-");
}

export function parseFlightId(flightId) {
  if (typeof flightId !== "string") {
    return null;
  }

  const match = /^([A-Z0-9]+)-([A-Z0-9]+)-(\d{8})-([A-Z0-9]+)-([A-Z0-9]+)$/u.exec(
    flightId,
  );

  if (!match) {
    return null;
  }

  const date = `${match[3].slice(0, 4)}-${match[3].slice(4, 6)}-${match[3].slice(6, 8)}`;
  if (!isValidIsoDate(date)) {
    return null;
  }

  return {
    airline: match[1],
    flight_number: match[2],
    service_date_internal: date,
    origin: match[4],
    destination: match[5],
  };
}

export function validateFlightId(flightId) {
  return parseFlightId(flightId) !== null;
}

function toFlightId(value) {
  if (typeof value === "string") {
    return value;
  }

  return buildFlightId(value);
}

export function compareFlightIdentity(left, right) {
  const leftId = toFlightId(left);
  const rightId = toFlightId(right);

  return (
    validateFlightId(leftId) &&
    validateFlightId(rightId) &&
    leftId === rightId
  );
}
