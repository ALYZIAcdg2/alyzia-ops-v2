import { assertAllowedValue, copyOwnFields } from "./modelUtils.js";

export const IMPORT_MODES = Object.freeze(["MANUAL", "AUTOMATIC"]);
export const IMPORT_STATUSES = Object.freeze([
  "PENDING",
  "PROCESSED",
  "NO_CHANGE",
  "REVIEW_REQUIRED",
  "ERROR",
]);
export const FILE_STATUSES = Object.freeze([
  "RECOGNIZED",
  "UNKNOWN",
  "UNSUPPORTED",
  "MISMATCH",
  "ERROR",
]);

const IMPORT_FIELDS = Object.freeze([
  "id",
  "flight_id",
  "import_mode",
  "import_status",
  "data_scope",
  "parser_name",
  "parser_version",
  "started_at",
  "completed_at",
  "created_by",
]);

export function createImportModel(input = {}) {
  assertAllowedValue(input.import_mode, IMPORT_MODES, "import_mode");
  assertAllowedValue(input.import_status, IMPORT_STATUSES, "import_status");
  return copyOwnFields(input, IMPORT_FIELDS);
}
