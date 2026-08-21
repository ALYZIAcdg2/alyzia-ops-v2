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

const IMPORT_STATUSES = new Set([
  "PENDING",
  "PROCESSED",
  "NO_CHANGE",
  "REVIEW_REQUIRED",
  "ERROR",
]);
const IMPORT_MODES = new Set(["MANUAL", "AUTOMATIC"]);
const ISSUE_RESOLUTIONS = new Set(["RESOLVED", "IGNORED"]);

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
  const importStatus = url.searchParams.get("status") || undefined;
  const importMode = url.searchParams.get("mode") || undefined;
  const query = url.searchParams.get("q")?.trim() || undefined;
  if (importStatus !== undefined && !IMPORT_STATUSES.has(importStatus)) {
    throw new ValidationError("query.status is invalid", {
      field: "query.status",
      allowed: [...IMPORT_STATUSES],
    });
  }
  if (importMode !== undefined && !IMPORT_MODES.has(importMode)) {
    throw new ValidationError("query.mode is invalid", {
      field: "query.mode",
      allowed: [...IMPORT_MODES],
    });
  }
  if (query !== undefined && query.length > 100) {
    throw new ValidationError("query.q must not exceed 100 characters", {
      field: "query.q",
    });
  }
  const rows = await createImportRepository(env.DB).listImports({
    limit: limit + 1,
    offset,
    import_status: importStatus,
    import_mode: importMode,
    query,
  });
  return jsonResponse({
    imports: rows.slice(0, limit),
    filters: {
      status: importStatus ?? null,
      mode: importMode ?? null,
      q: query ?? null,
    },
    pagination: {
      limit,
      offset,
      has_more: rows.length > limit,
      has_previous: offset > 0,
    },
  });
}

async function getImportSummary(env) {
  const summary = await createImportRepository(env.DB).getImportSummary();
  return jsonResponse({
    summary: Object.fromEntries(
      Object.entries(summary).map(([key, value]) => [key, Number(value ?? 0)]),
    ),
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

function nestedIssueRoute(pathname) {
  const match = pathname.match(/^\/api\/imports\/([^/]+)\/issues\/(\d+)$/u);
  if (!match) return null;
  try {
    return {
      importId: decodeURIComponent(match[1]),
      issueId: Number(match[2]),
    };
  } catch {
    return null;
  }
}

async function resolveIssue(request, env, { importId, issueId }) {
  await requireWriteAuthorization(request, env);
  const payload = await readJsonBody(request, { maximumBytes: 16_000 });
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Issue resolution payload must be an object", {
      field: "body",
    });
  }
  const resolutionStatus = payload.resolution_status;
  const resolvedBy = payload.resolved_by?.trim();
  if (!ISSUE_RESOLUTIONS.has(resolutionStatus)) {
    throw new ValidationError("resolution_status is invalid", {
      field: "body.resolution_status",
      allowed: [...ISSUE_RESOLUTIONS],
    });
  }
  if (!resolvedBy || resolvedBy.length > 100) {
    throw new ValidationError("resolved_by is required and limited to 100 characters", {
      field: "body.resolved_by",
    });
  }
  const repository = createImportRepository(env.DB);
  if (!(await repository.getImportById(importId))) {
    return jsonResponse(
      { error: "Import not found", code: "IMPORT_NOT_FOUND" },
      { status: 404 },
    );
  }
  const result = await repository.resolveImportIssue(importId, issueId, {
    resolution_status: resolutionStatus,
    resolved_by: resolvedBy,
  });
  if (Number(result.meta?.changes ?? 0) === 0) {
    return jsonResponse(
      { error: "Import issue not found", code: "IMPORT_ISSUE_NOT_FOUND" },
      { status: 404 },
    );
  }
  const issues = await repository.getIssuesByImportId(importId);
  return jsonResponse({
    import_id: importId,
    issue: issues.find((issue) => Number(issue.id) === issueId) ?? null,
  });
}

export async function handleImportApi(request, env, url) {
  if (url.pathname === "/api/imports/summary") {
    if (request.method !== "GET") {
      return methodNotAllowed(["GET"]);
    }
    return getImportSummary(env);
  }

  const issueRoute = nestedIssueRoute(url.pathname);
  if (issueRoute) {
    if (request.method !== "PATCH") {
      return methodNotAllowed(["PATCH"]);
    }
    return resolveIssue(request, env, issueRoute);
  }

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
