import { createFlightImportModel } from "../models/flightImportModel.js";
import { IMPORT_MODES } from "../models/importModel.js";
import { isValidDataScope } from "../utils/scopeUtils.js";
import {
  createBlockingIssue,
  createReviewIssue,
} from "../utils/issueFactory.js";

export const IMPORT_PIPELINE_PHASES = Object.freeze([
  "validation",
  "flight_matching",
  "snapshot",
  "overrides",
  "comparison",
  "plan",
  "conflicts",
  "execution",
  "field_history",
  "import_status",
]);

function createPendingPhases() {
  return Object.fromEntries(
    IMPORT_PIPELINE_PHASES.map((phase) => [phase, { status: "PENDING" }]),
  );
}

function validateContext(context) {
  const issues = [];

  if (!context || typeof context !== "object") {
    return [
      createBlockingIssue({
        issue_code: "IMPORT_CONTEXT_MISSING",
        field_path: "context",
        message: "Import context is required.",
      }),
    ];
  }

  if (typeof context.import_id !== "string" || context.import_id.trim() === "") {
    issues.push(
      createBlockingIssue({
        issue_code: "IMPORT_ID_MISSING",
        field_path: "context.import_id",
        message: "A non-empty import_id is required.",
      }),
    );
  }

  if (!IMPORT_MODES.includes(context.import_mode)) {
    issues.push(
      createBlockingIssue({
        issue_code: "IMPORT_MODE_INVALID",
        field_path: "context.import_mode",
        incoming_value: context.import_mode,
        message: "import_mode must be MANUAL or AUTOMATIC.",
      }),
    );
  }

  if (
    context.data_scope !== undefined &&
    context.data_scope !== null &&
    !isValidDataScope(context.data_scope)
  ) {
    issues.push(
      createBlockingIssue({
        issue_code: "DATA_SCOPE_INVALID",
        field_path: "context.data_scope",
        incoming_value: context.data_scope,
        message: "data_scope must be FULL, PARTIAL or null.",
      }),
    );
  }

  return issues;
}

function normalizeModel(model, issues) {
  try {
    return createFlightImportModel(model);
  } catch (error) {
    issues.push(
      createBlockingIssue({
        issue_code: "MODEL_CONTRACT_INVALID",
        field_path: "model",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return null;
  }
}

export async function importFlightData({ db, model, context } = {}) {
  if (!db || typeof db.prepare !== "function") {
    throw new TypeError("importFlightData requires a D1 database binding");
  }

  const phases = createPendingPhases();
  const issues = validateContext(context);
  const normalizedModel = normalizeModel(model, issues);

  if (issues.some((issue) => issue.severity === "BLOCKING")) {
    phases.validation = { status: "ERROR" };
    return {
      import_id: context?.import_id ?? null,
      status: "ERROR",
      model: normalizedModel,
      phases,
      snapshot: null,
      overrides: [],
      differences: [],
      plan: { operations: [] },
      conflicts: [],
      issues,
    };
  }

  phases.validation = { status: "COMPLETED" };
  issues.push(
    createReviewIssue({
      issue_code: "IMPORT_ENGINE_SCAFFOLD_ONLY",
      field_path: "import",
      message:
        "Lot 1 validates the contract only; matching, comparison and execution are intentionally pending.",
    }),
  );

  return {
    import_id: context.import_id,
    status: "REVIEW_REQUIRED",
    model: normalizedModel,
    phases,
    snapshot: null,
    overrides: [],
    differences: [],
    plan: { operations: [] },
    conflicts: [],
    issues,
  };
}
