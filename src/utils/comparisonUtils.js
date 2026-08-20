function encodeStable(value) {
  if (value === undefined) {
    return { $type: "undefined" };
  }

  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return { $type: "number", value: "NaN" };
    }
    if (Object.is(value, -0)) {
      return { $type: "number", value: "-0" };
    }
    if (!Number.isFinite(value)) {
      return { $type: "number", value: String(value) };
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(encodeStable);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, encodeStable(value[key])]),
    );
  }

  return value;
}

export function stableStringify(value) {
  return JSON.stringify(encodeStable(value));
}

export function strictValueEqual(left, right) {
  return stableStringify(left) === stableStringify(right);
}

export function valueState(value, { present = true } = {}) {
  if (!present) {
    return "ABSENT";
  }
  if (value === undefined) {
    return "UNDEFINED";
  }
  if (value === null) {
    return "NULL";
  }
  if (Object.is(value, 0)) {
    return "ZERO";
  }
  return "VALUE";
}

export function compareField(current, incoming, field) {
  const currentPresent = Object.hasOwn(current, field);
  const incomingPresent = Object.hasOwn(incoming, field);
  const currentValue = currentPresent ? current[field] : undefined;
  const incomingValue = incomingPresent ? incoming[field] : undefined;

  return {
    equal:
      currentPresent === incomingPresent &&
      strictValueEqual(currentValue, incomingValue),
    current_state: valueState(currentValue, { present: currentPresent }),
    incoming_state: valueState(incomingValue, { present: incomingPresent }),
    current_value: currentValue,
    incoming_value: incomingValue,
  };
}

export function stableCollectionKey(item, fields) {
  if (!fields) {
    return stableStringify(item);
  }

  return stableStringify(
    Object.fromEntries(fields.map((field) => [field, item?.[field]])),
  );
}

export function compareCollections(left, right, { keyFields } = {}) {
  if (!Array.isArray(left) || !Array.isArray(right)) {
    return false;
  }

  const leftKeys = left
    .map((item) => stableCollectionKey(item, keyFields))
    .sort();
  const rightKeys = right
    .map((item) => stableCollectionKey(item, keyFields))
    .sort();

  return strictValueEqual(leftKeys, rightKeys);
}
