import { createFlightRepository } from "../database/flightRepository.js";
import { createImportExecutionRepository } from "../database/importExecutionRepository.js";
import { createImportRepository } from "../database/importRepository.js";
import { createManualChangeRepository } from "../database/manualChangeRepository.js";
import { IMPORT_MODES } from "../models/importModel.js";
import { createFlightCreationService } from "../services/flightCreationService.js";
import { createFlightQueryService } from "../services/flightQueryService.js";
import { normalizeFlightCreationInput } from "../services/flightValidation.js";
import { stableStringify } from "../utils/comparisonUtils.js";
import { createBlockingIssue } from "../utils/issueFactory.js";
import { isValidDataScope } from "../utils/scopeUtils.js";
import { compareImportModels } from "./importComparison.js";
import { createImportPlan } from "./importPlan.js";

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
  if (!context || typeof context !== "object" || Array.isArray(context)) {
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
  if (!isValidDataScope(context.data_scope)) {
    issues.push(
      createBlockingIssue({
        issue_code: "DATA_SCOPE_INVALID",
        field_path: "context.data_scope",
        incoming_value: context.data_scope,
        message: "data_scope must be FULL or PARTIAL.",
      }),
    );
  }
  if (typeof context.user_id !== "string" || context.user_id.trim() === "") {
    issues.push(
      createBlockingIssue({
        issue_code: "IMPORT_USER_MISSING",
        field_path: "context.user_id",
        message: "A non-empty user_id is required.",
      }),
    );
  }
  if (
    context.block_scopes !== undefined &&
    (context.block_scopes === null ||
      typeof context.block_scopes !== "object" ||
      Array.isArray(context.block_scopes))
  ) {
    issues.push(
      createBlockingIssue({
        issue_code: "BLOCK_SCOPES_INVALID",
        field_path: "context.block_scopes",
        message: "block_scopes must be an object when supplied.",
      }),
    );
  }
  return issues;
}

function normalizeModel(model, issues) {
  try {
    return normalizeFlightCreationInput({
      ...model,
      import: {},
      issues: [],
    });
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

function serialized(value) {
  return value === undefined ? null : stableStringify(value);
}

function issueForStorage(issue) {
  return {
    ...issue,
    current_value: serialized(issue.current_value),
    incoming_value: serialized(issue.incoming_value),
  };
}

function historyFromOperations({ operations, flightId, importId, userId, now }) {
  return operations.map((operation) => ({
    flight_id: flightId,
    import_id: importId,
    entity_type: operation.difference.entity_type,
    entity_id:
      operation.difference.entity_id === null
        ? null
        : String(operation.difference.entity_id),
    field_path: operation.difference.field_path,
    old_value: serialized(operation.difference.current_value),
    new_value: serialized(operation.difference.incoming_value),
    change_action: operation.action,
    changed_by: userId,
    changed_at: now,
  }));
}

async function persistIssues(repository, importId, issues) {
  for (const issue of issues) {
    await repository.addIssue(importId, issueForStorage(issue));
  }
}

function resultBase({ context, model, phases, snapshot, overrides, differences, plan, conflicts, issues }) {
  return {
    import_id: context?.import_id ?? null,
    model,
    phases,
    snapshot,
    overrides,
    differences,
    plan,
    conflicts,
    issues,
  };
}

function sourceRecord(context) {
  const source = context.source ?? {};
  return {
    source_type: source.source_type ?? "STRUCTURED_JSON",
    source_name: source.source_name ?? "ALYZIA OPS LOT 3",
    ...(source.source_document === undefined
      ? {}
      : { source_document: source.source_document }),
    detected_type: source.detected_type ?? "FLIGHT_IMPORT_MODEL",
    detection_confidence: source.detection_confidence ?? 1,
    ...(source.source_timestamp === undefined
      ? {}
      : { source_timestamp: source.source_timestamp }),
    file_status: source.file_status ?? "RECOGNIZED",
  };
}

async function createImportRecord(repository, context, flightId, startedAt) {
  await repository.createImport({
    id: context.import_id,
    ...(flightId ? { flight_id: flightId } : {}),
    import_mode: context.import_mode,
    import_status: "PENDING",
    data_scope: context.data_scope,
    parser_name: context.parser_name ?? "structured-model",
    parser_version: context.parser_version ?? "1.0.0",
    started_at: startedAt,
    created_by: context.user_id,
  });
  await repository.addSource(context.import_id, sourceRecord(context));
}

function completedPhases(phases, names) {
  for (const name of names) {
    phases[name] = { status: "COMPLETED" };
  }
}

export async function importFlightData({ db, model, context } = {}) {
  if (!db || typeof db.prepare !== "function") {
    throw new TypeError("importFlightData requires a D1 database binding");
  }

  const phases = createPendingPhases();
  const issues = validateContext(context);
  const empty = {
    snapshot: null,
    overrides: [],
    differences: [],
    plan: { operations: [] },
    conflicts: [],
  };
  if (issues.some((issue) => issue.severity === "BLOCKING")) {
    phases.validation = { status: "ERROR" };
    return {
      ...resultBase({ context, model: null, phases, issues, ...empty }),
      status: "ERROR",
    };
  }

  const importRepository = createImportRepository(db);
  if (await importRepository.getImportById(context.import_id)) {
    issues.push(
      createBlockingIssue({
        issue_code: "IMPORT_ID_ALREADY_EXISTS",
        field_path: "context.import_id",
        incoming_value: context.import_id,
        message: "The import_id already exists and cannot be replayed.",
      }),
    );
    phases.import_status = { status: "ERROR" };
    return {
      ...resultBase({ context, model: null, phases, issues, ...empty }),
      status: "ERROR",
    };
  }

  const normalizedModel = normalizeModel(model, issues);
  if (issues.some((issue) => issue.severity === "BLOCKING")) {
    const startedAt = new Date().toISOString();
    await createImportRecord(importRepository, context, null, startedAt);
    await persistIssues(importRepository, context.import_id, issues);
    await importRepository.updateImportStatus(context.import_id, "ERROR", {
      completed_at: new Date().toISOString(),
    });
    phases.validation = { status: "ERROR" };
    phases.import_status = { status: "COMPLETED" };
    return {
      ...resultBase({ context, model: null, phases, issues, ...empty }),
      status: "ERROR",
    };
  }
  phases.validation = { status: "COMPLETED" };

  const now = new Date().toISOString();
  const flightRepository = createFlightRepository(db);
  const matchedFlight = await flightRepository.findExact(normalizedModel.flight);
  phases.flight_matching = {
    status: "COMPLETED",
    result: matchedFlight ? "EXACT_MATCH" : "NEW_FLIGHT",
  };
  await createImportRecord(
    importRepository,
    context,
    matchedFlight?.id ?? null,
    now,
  );

  if (!matchedFlight) {
    try {
      const created = await createFlightCreationService(db).create(normalizedModel);
      const flightId = created.flight.flight_id;
      await importRepository.attachFlight(context.import_id, flightId);
      const history = historyFromOperations({
        operations: [
          {
            difference: {
              entity_type: "FLIGHT",
              entity_id: flightId,
              field_path: "flight",
              current_value: undefined,
              incoming_value: normalizedModel,
            },
            action: "CREATE",
          },
        ],
        flightId,
        importId: context.import_id,
        userId: context.user_id,
        now,
      });
      await createImportExecutionRepository(db).executeAtomically(
        flightId,
        [],
        history,
      );
      await importRepository.updateImportStatus(context.import_id, "PROCESSED", {
        completed_at: new Date().toISOString(),
      });
      completedPhases(phases, [
        "snapshot",
        "overrides",
        "comparison",
        "plan",
        "conflicts",
        "execution",
        "field_history",
        "import_status",
      ]);
      return {
        ...resultBase({
          context,
          model: normalizedModel,
          phases,
          snapshot: null,
          overrides: [],
          differences: [{ field_path: "flight", action: "CREATE" }],
          plan: { operations: [{ type: "CREATE_FLIGHT", action: "CREATE" }] },
          conflicts: [],
          issues,
        }),
        status: "PROCESSED",
        flight: created,
      };
    } catch (error) {
      issues.push(
        createBlockingIssue({
          issue_code: "IMPORT_EXECUTION_FAILED",
          field_path: "execution",
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      await persistIssues(importRepository, context.import_id, issues);
      await importRepository.updateImportStatus(context.import_id, "ERROR", {
        completed_at: new Date().toISOString(),
      });
      phases.execution = { status: "ERROR" };
      phases.import_status = { status: "COMPLETED" };
      return {
        ...resultBase({ context, model: normalizedModel, phases, issues, ...empty }),
        status: "ERROR",
      };
    }
  }

  const flightId = matchedFlight.id;
  const snapshot = await createFlightQueryService(db).findById(flightId);
  phases.snapshot = { status: "COMPLETED" };
  const overrides = await createManualChangeRepository(db).getActiveByFlightId(flightId);
  phases.overrides = { status: "COMPLETED" };
  const differences = compareImportModels({
    current: snapshot,
    incoming: normalizedModel,
    source: model,
  });
  phases.comparison = { status: "COMPLETED" };
  const planResult = createImportPlan({ differences, overrides, context });
  issues.push(...planResult.issues);
  phases.plan = { status: "COMPLETED" };
  phases.conflicts = { status: "COMPLETED" };

  if (planResult.conflicts.length > 0) {
    await persistIssues(importRepository, context.import_id, issues);
    await importRepository.updateImportStatus(context.import_id, "REVIEW_REQUIRED", {
      completed_at: new Date().toISOString(),
    });
    phases.execution = { status: "SKIPPED" };
    phases.field_history = { status: "SKIPPED" };
    phases.import_status = { status: "COMPLETED" };
    return {
      ...resultBase({
        context,
        model: normalizedModel,
        phases,
        snapshot,
        overrides,
        differences,
        plan: { operations: planResult.operations },
        conflicts: planResult.conflicts,
        issues,
      }),
      status: "REVIEW_REQUIRED",
    };
  }

  if (planResult.operations.length === 0) {
    await persistIssues(importRepository, context.import_id, issues);
    await importRepository.updateImportStatus(context.import_id, "NO_CHANGE", {
      completed_at: new Date().toISOString(),
    });
    phases.execution = { status: "SKIPPED" };
    phases.field_history = { status: "COMPLETED" };
    phases.import_status = { status: "COMPLETED" };
    return {
      ...resultBase({
        context,
        model: normalizedModel,
        phases,
        snapshot,
        overrides,
        differences,
        plan: { operations: [] },
        conflicts: [],
        issues,
      }),
      status: "NO_CHANGE",
    };
  }

  const history = historyFromOperations({
    operations: planResult.operations,
    flightId,
    importId: context.import_id,
    userId: context.user_id,
    now,
  });
  try {
    await createImportExecutionRepository(db).executeAtomically(
      flightId,
      planResult.operations,
      history,
    );
    phases.execution = { status: "COMPLETED" };
    phases.field_history = { status: "COMPLETED" };
    await persistIssues(importRepository, context.import_id, issues);
    await importRepository.updateImportStatus(context.import_id, "PROCESSED", {
      completed_at: new Date().toISOString(),
    });
    phases.import_status = { status: "COMPLETED" };
    return {
      ...resultBase({
        context,
        model: normalizedModel,
        phases,
        snapshot,
        overrides,
        differences,
        plan: { operations: planResult.operations },
        conflicts: [],
        issues,
      }),
      status: "PROCESSED",
      flight: await createFlightQueryService(db).findById(flightId),
    };
  } catch (error) {
    phases.execution = { status: "ERROR" };
    issues.push(
      createBlockingIssue({
        issue_code: "IMPORT_EXECUTION_FAILED",
        field_path: "execution",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    await persistIssues(importRepository, context.import_id, issues);
    await importRepository.updateImportStatus(context.import_id, "ERROR", {
      completed_at: new Date().toISOString(),
    });
    phases.import_status = { status: "COMPLETED" };
    return {
      ...resultBase({
        context,
        model: normalizedModel,
        phases,
        snapshot,
        overrides,
        differences,
        plan: { operations: planResult.operations },
        conflicts: [],
        issues,
      }),
      status: "ERROR",
    };
  }
}
