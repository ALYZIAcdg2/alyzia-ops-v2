import { strictValueEqual } from "./comparisonUtils.js";

export const OVERRIDE_TYPES = Object.freeze(["TEMPORARY", "LOCKED"]);
export const OVERRIDE_STATES = Object.freeze([
  "SAME_VALUE",
  "CONFLICT",
  "MULTIPLE_ACTIVE_OVERRIDES",
]);

export function compareOverrideValues(overrideValue, incomingValue) {
  return strictValueEqual(overrideValue, incomingValue)
    ? "SAME_VALUE"
    : "CONFLICT";
}

export function evaluateActiveOverrides({
  activeOverrides = [],
  incomingValue,
} = {}) {
  if (!Array.isArray(activeOverrides)) {
    throw new TypeError("activeOverrides must be an array");
  }

  if (activeOverrides.length > 1) {
    return {
      state: "MULTIPLE_ACTIVE_OVERRIDES",
      overrides: activeOverrides,
    };
  }

  if (activeOverrides.length === 0) {
    return { state: null, overrides: [] };
  }

  const override = activeOverrides[0];
  return {
    state: compareOverrideValues(override.new_value, incomingValue),
    override,
  };
}
