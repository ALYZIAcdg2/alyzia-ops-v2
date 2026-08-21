import { ValidationError } from "./serviceErrors.js";

export function fail(field, message) {
  throw new ValidationError(message, { field });
}

export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function assertRecord(value, field) {
  if (!isRecord(value)) {
    fail(field, `${field} must be an object`);
  }
}

export function assertKnownFields(value, allowedFields, field) {
  assertRecord(value, field);
  const unknown = Object.keys(value).filter(
    (key) => !allowedFields.includes(key),
  );
  if (unknown.length > 0) {
    fail(field, `${field} contains unsupported fields: ${unknown.join(", ")}`);
  }
}

export function requiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(field, `${field} is required`);
  }
  return value.trim();
}

export function optionalString(value, field) {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value !== "string") {
    fail(field, `${field} must be a string or null`);
  }
  return value;
}

export function normalizeClassCode(value, field) {
  return requiredString(value, field).toUpperCase();
}

export function assertNonNegativeInteger(
  value,
  field,
  { nullable = true } = {},
) {
  if (nullable && value === null) {
    return;
  }
  if (!Number.isInteger(value) || value < 0) {
    const suffix = nullable ? " or null" : "";
    fail(field, `${field} must be a non-negative integer${suffix}`);
  }
}

export function assertArray(value, field) {
  if (!Array.isArray(value)) {
    fail(field, `${field} must be an array`);
  }
}

export function assertNestedArray(value, field, allowedFields) {
  assertArray(value, field);
  value.forEach((entry, index) =>
    assertKnownFields(entry, allowedFields, `${field}[${index}]`),
  );
}

export function validateOptionalStrings(target, fields, path) {
  for (const field of fields) {
    if (Object.hasOwn(target, field)) {
      optionalString(target[field], `${path}.${field}`);
    }
  }
}

export function assertUniqueClassCodes(entries, path) {
  const classes = new Set();
  entries.forEach((entry, index) => {
    if (classes.has(entry.class)) {
      fail(`${path}[${index}].class`, `${path} contains a duplicate class`);
    }
    classes.add(entry.class);
  });
}
