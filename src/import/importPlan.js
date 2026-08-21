import { canRemoveMissingValue } from "../utils/scopeUtils.js";
import { evaluateActiveOverrides } from "../utils/overrideUtils.js";
import { createReviewIssue, createWarningIssue } from "../utils/issueFactory.js";

function blockPolicy(context, blockPath) {
  const policy = context.block_scopes?.[blockPath] ?? {};
  return {
    data_scope: context.data_scope,
    block_scope: policy.block_scope,
    block_reliability: policy.block_reliability,
    block_present: policy.block_present,
    ambiguous: policy.ambiguous === true,
    protected_value: policy.protected_value === true,
  };
}

function overrideForPath(overrides, fieldPath) {
  return overrides.filter((override) => override.field_path === fieldPath);
}

function decodedStoredValue(value) {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function removalOperation(operation) {
  const byUpsert = {
    UPSERT_CABIN_CLASS: "REMOVE_CABIN_CLASS",
    UPSERT_LOAD_CLASS: "REMOVE_LOAD_CLASS",
    UPSERT_LOAD_TOTAL: "REMOVE_LOAD_TOTAL",
  };
  return byUpsert[operation.type] ? { ...operation, type: byUpsert[operation.type] } : null;
}

export function createImportPlan({ differences, overrides, context }) {
  const operations = [];
  const conflicts = [];
  const issues = [];

  for (const item of differences) {
    if (item.operation.type === "REVIEW_STRUCTURAL_BLOCK") {
      conflicts.push({ ...item, reason: "STRUCTURAL_MATCHING_REQUIRED" });
      issues.push(
        createReviewIssue({
          issue_code: "STRUCTURAL_MATCHING_REQUIRED",
          field_path: item.field_path,
          current_value: item.current_value,
          incoming_value: item.incoming_value,
          message: `Le bloc ${item.field_path} nécessite un matching métier explicite avant modification.`,
        }),
      );
      continue;
    }

    const activeOverrides = overrideForPath(overrides, item.field_path);
    const overrideEvaluation = evaluateActiveOverrides({
      activeOverrides: activeOverrides.map((override) => ({
        ...override,
        new_value: decodedStoredValue(override.new_value),
      })),
      incomingValue: item.incoming_value,
    });
    if (
      overrideEvaluation.state === "CONFLICT" ||
      overrideEvaluation.state === "MULTIPLE_ACTIVE_OVERRIDES"
    ) {
      conflicts.push({
        ...item,
        reason: overrideEvaluation.state,
        overrides: overrideEvaluation.overrides ?? [overrideEvaluation.override],
      });
      issues.push(
        createReviewIssue({
          issue_code: overrideEvaluation.state,
          field_path: item.field_path,
          current_value: item.current_value,
          incoming_value: item.incoming_value,
          message: "Une correction manuelle active protège cette valeur.",
        }),
      );
      continue;
    }

    if (!item.incoming_present) {
      const removal = canRemoveMissingValue(blockPolicy(context, item.block_path));
      const operation = removalOperation(item.operation);
      if (!removal.allowed || !operation) {
        issues.push(
          createWarningIssue({
            issue_code: "REMOVAL_NOT_AUTHORIZED",
            field_path: item.field_path,
            current_value: item.current_value,
            message: `Suppression ignorée : ${removal.reason}.`,
          }),
        );
        continue;
      }
      operations.push({ ...operation, difference: item, action: "REMOVE" });
      continue;
    }

    operations.push({
      ...item.operation,
      value: item.incoming_value,
      difference: item,
      action: item.current_present ? "UPDATE" : "ADD",
    });
  }

  return { operations, conflicts, issues };
}
