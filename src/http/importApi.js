import { createHistoryRepository } from "../database/historyRepository.js";
import { createImportRepository } from "../database/importRepository.js";
import { importFlightData } from "../import/importFlightData.js";
import { ValidationError } from "../services/serviceErrors.js";
import {
  jsonResponse,
  methodNotAllowed,
  readJsonBody,
  routeIdentifier,
} from "./httpUtils.js";
import { requireWriteAuthorization } from "./writeAuthorization.js";

function parseInteger(value, { field, minimum, maximum, fallback }) {
  if (value === null || value === "") {
    return fallback;
  }
  if (!/^\d+$/u.test(value)) {
    throw new ValidationError(`${field} must be an integer`, { field });
  }
  const parsed = Number(value);
  if (parsed < minimum || parsed > maximum) {
    throw new ValidationError(
      `${field} must be between ${minimum} and ${maximum}`,
      { field },
    );
  }
  return parsed;
}

async function listImports(env, url) {
  const limit = parseInteger(url.searchParams.get("limit"), {
    field: "query.limit",
    minimum: 1,
    maximum: 100,
    fallback: 25,
  });
  const offset = parseInteger(url.searchParams.get("offset"), {
    field: "query.offset",
    minimum: 0,
    maximum: 100_000,
    fallback: 0,
  });
  const rows = await createImportRepository(env.DB).listImports({
    limit: limit + 1,
    offset,
  });
  return jsonResponse({
    imports: rows.slice(0, limit),
    pagination: { limit, offset, has_more: rows.length > limit },
  });
}

async function getImport(env, importId) {
  const repository = createImportRepository(env.DB);
  const record = await repository.getImportById(importId);
  if (!record) {
    return jsonResponse(
      { error: "Import not found", code: "IMPORT_NOT_FOUND" },
      { status: 404 },
    );
  }
  const [sources, issues, history] = await Promise.all([
    repository.getSourcesByImportId(importId),
    repository.getIssuesByImportId(importId),
    createHistoryRepository(env.DB).getByImportId(importId),
  ]);
  return jsonResponse({ import: record, sources, issues, history });
}

async function createImport(request, env, url) {
  await requireWriteAuthorization(request, env);
  const payload = await readJsonBody(request);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Import payload must be an object", {
      field: "body",
    });
  }
  const result = await importFlightData({
    db: env.DB,
    model: payload.model,
    context: payload.context,
  });
  const duplicate = result.issues.some(
    (issue) => issue.issue_code === "IMPORT_ID_ALREADY_EXISTS",
  );
  const validationError =
    result.status === "ERROR" &&
    result.phases.validation?.status === "ERROR";
  const status = duplicate
    ? 409
    : validationError
      ? 400
      : result.status === "REVIEW_REQUIRED"
        ? 202
        : result.status === "PROCESSED"
          ? 201
          : 200;
  const location = new URL(
    `/api/imports/${encodeURIComponent(result.import_id)}`,
    url,
  );
  if (status >= 400) {
    const primaryIssue = result.issues[0];
    return jsonResponse(
      {
        error: primaryIssue?.message ?? "Structured import rejected",
        code: primaryIssue?.issue_code ?? "IMPORT_REJECTED",
        details: { result },
      },
      { status },
    );
  }
  return jsonResponse(
    { result },
    {
      status,
      headers:
        result.import_id === null ? {} : { Location: location.toString() },
    },
  );
}

export async function handleImportApi(request, env, url) {
  if (url.pathname === "/api/imports" || url.pathname === "/api/imports/") {
    if (request.method === "GET") {
      return listImports(env, url);
    }
    if (request.method === "POST") {
      return createImport(request, env, url);
    }
    return methodNotAllowed(["GET", "POST"]);
  }

  const importId = routeIdentifier(url.pathname, "/api/imports/");
  if (importId === null) {
    return null;
  }
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }
  return getImport(env, importId);
}
