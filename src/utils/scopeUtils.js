export const DATA_SCOPES = Object.freeze(["FULL", "PARTIAL"]);

export function isValidDataScope(value) {
  return DATA_SCOPES.includes(value);
}

export function canRemoveMissingValue({
  data_scope,
  block_scope,
  block_reliability,
  block_present,
  ambiguous = false,
  protected_value = false,
} = {}) {
  if (data_scope !== "FULL") {
    return { allowed: false, reason: "DATA_SCOPE_NOT_FULL" };
  }
  if (block_scope !== "FULL") {
    return { allowed: false, reason: "BLOCK_SCOPE_NOT_FULL" };
  }
  if (block_reliability !== true) {
    return { allowed: false, reason: "BLOCK_NOT_RELIABLE" };
  }
  if (block_present !== true) {
    return { allowed: false, reason: "BLOCK_ABSENT" };
  }
  if (ambiguous) {
    return { allowed: false, reason: "BLOCK_AMBIGUOUS" };
  }
  if (protected_value) {
    return { allowed: false, reason: "VALUE_PROTECTED" };
  }

  return { allowed: true, reason: "RELIABLE_FULL_BLOCK" };
}
