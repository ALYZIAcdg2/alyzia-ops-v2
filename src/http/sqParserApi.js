import { createImportRepository } from "../database/importRepository.js";
import { importFlightData } from "../import/importFlightData.js";
import { parseSqEditing } from "../parsers/sq/parseSqEditing.js";
import { stableStringify } from "../utils/comparisonUtils.js";
import { ValidationError } from "../services/serviceErrors.js";
import { jsonResponse, methodNotAllowed, readJsonBody } from "./httpUtils.js";
import { requireWriteAuthorization } from "./writeAuthorization.js";

function validatePayload(payload, { requireContext = false } = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("SQ parser payload must be an object", {
      field: "body",
    });
  }
  if (typeof payload.source_text !== "string" || payload.source_text.trim() === "") {
    throw new ValidationError("source_text must be a non-empty string", {
      field: "body.source_text",
    });
  }
  if (
    payload.options !== undefined &&
    (payload.options === null ||
      typeof payload.options !== "object" ||
      Array.isArray(payload.options))
  ) {
    throw new ValidationError("options must be an object", {
      field: "body.options",
    });
  }
  if (
    requireContext &&
    (!payload.context ||
      typeof payload.context !== "object" ||
      Array.isArray(payload.context))
  ) {
    throw new ValidationError("context must be an object", {
      field: "body.context",
    });
  }
}

function parsePayload(payload) {
  try {
    return parseSqEditing({
      source_text: payload.source_text,
      options: payload.options,
    });
  } catch (error) {
    throw new ValidationError(
      error instanceof Error ? error.message : "SQ source cannot be parsed",
      { field: "body.source_text" },
    );
  }
}

function serializeIssueValue(value) {
  return value === undefined ? null : stableStringify(value);
}

async function persistParserIssues(db, importId, issues) {
  const repository = createImportRepository(db);
  for (const issue of issues) {
    await repository.addIssue(importId, {
      ...issue,
      current_value: serializeIssueValue(issue.current_value),
      incoming_value: serializeIssueValue(issue.incoming_value),
    });
  }
}

async function previewSq(request, env) {
  await requireWriteAuthorization(request, env);
  const payload = await readJsonBody(request);
  validatePayload(payload);
  return jsonResponse({ parse: parsePayload(payload) });
}

function parserContext(payload, parsed) {
  const sourceName =
    typeof payload.source_name === "string" && payload.source_name.trim() !== ""
      ? payload.source_name.trim().slice(0, 200)
      : "SQ editing text";
  return {
    ...payload.context,
    parser_name: parsed.parser.name,
    parser_version: parsed.parser.version,
    source: {
      source_type: "TEXT",
      source_name: sourceName,
      detected_type: parsed.parser.detected_type,
      detection_confidence: parsed.parser.detection_confidence,
      file_status: "RECOGNIZED",
    },
  };
}

async function importSq(request, env, url) {
  await requireWriteAuthorization(request, env);
  const payload = await readJsonBody(request);
  validatePayload(payload, { requireContext: true });
  const parsed = parsePayload(payload);
  if (!parsed.can_import) {
    return jsonResponse(
      {
        error: "SQ source requires review before import",
        code: "SQ_REVIEW_REQUIRED",
        details: { parse: parsed },
      },
      { status: 422 },
    );
  }

  const context = parserContext(payload, parsed);
  const result = await importFlightData({
    db: env.DB,
    model: parsed.model,
    context,
  });
  if (result.import_id !== null && parsed.issues.length > 0) {
    await persistParserIssues(env.DB, result.import_id, parsed.issues);
  }
  const status =
    result.status === "PROCESSED"
      ? 201
      : result.status === "REVIEW_REQUIRED"
        ? 202
        : result.status === "ERROR"
          ? 400
          : 200;
  const location = new URL(
    `/api/imports/${encodeURIComponent(result.import_id)}`,
    url,
  );
  return jsonResponse(
    { parse: parsed, result },
    {
      status,
      headers:
        result.import_id === null ? {} : { Location: location.toString() },
    },
  );
}

export async function handleSqParserApi(request, env, url) {
  if (url.pathname === "/api/sq/parse") {
    if (request.method !== "POST") {
      return methodNotAllowed(["POST"]);
    }
    return previewSq(request, env);
  }
  if (url.pathname === "/api/sq/import") {
    if (request.method !== "POST") {
      return methodNotAllowed(["POST"]);
    }
    return importSq(request, env, url);
  }
  return null;
}
