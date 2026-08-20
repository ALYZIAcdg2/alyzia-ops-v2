export function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]),
    );
  }

  return value;
}

export function copyOwnFields(source, fields) {
  const target = {};

  for (const field of fields) {
    if (Object.hasOwn(source, field)) {
      target[field] = cloneValue(source[field]);
    }
  }

  return target;
}

export function copyArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${fieldName} must be an array`);
  }

  return value.map(cloneValue);
}

export function assertAllowedValue(value, allowedValues, fieldName) {
  if (value === undefined || value === null) {
    return;
  }

  if (!allowedValues.includes(value)) {
    throw new RangeError(`${fieldName} has an unsupported value: ${value}`);
  }
}
