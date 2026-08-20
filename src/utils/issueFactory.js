export const ISSUE_SEVERITIES = Object.freeze([
  "INFO",
  "WARNING",
  "REVIEW",
  "BLOCKING",
]);

export function createIssue({
  severity,
  issue_code,
  field_path,
  current_value,
  incoming_value,
  message,
  resolution_status = "OPEN",
} = {}) {
  if (!ISSUE_SEVERITIES.includes(severity)) {
    throw new RangeError(`unsupported issue severity: ${severity}`);
  }

  if (typeof issue_code !== "string" || issue_code.trim() === "") {
    throw new TypeError("issue_code must be a non-empty string");
  }

  return {
    severity,
    issue_code,
    ...(field_path === undefined ? {} : { field_path }),
    ...(current_value === undefined ? {} : { current_value }),
    ...(incoming_value === undefined ? {} : { incoming_value }),
    ...(message === undefined ? {} : { message }),
    resolution_status,
  };
}

export const createInfoIssue = (input) =>
  createIssue({ ...input, severity: "INFO" });
export const createWarningIssue = (input) =>
  createIssue({ ...input, severity: "WARNING" });
export const createReviewIssue = (input) =>
  createIssue({ ...input, severity: "REVIEW" });
export const createBlockingIssue = (input) =>
  createIssue({ ...input, severity: "BLOCKING" });
