import { createIngestionRepository } from "../database/ingestionRepository.js";
import { ingestGmailMessage } from "../services/gmailIngestionService.js";
import { ValidationError } from "../services/serviceErrors.js";
import {
  jsonResponse,
  methodNotAllowed,
  readJsonBody,
  routeIdentifier,
} from "./httpUtils.js";
import { requireWriteAuthorization } from "./writeAuthorization.js";

const MAX_REQUEST_BYTES = 35_000_000;

function parseInteger(value, { field, minimum, maximum, fallback }) {
  if (value === null || value === "") return fallback;
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

function publicMessage(record) {
  if (!record) return null;
  return {
    id: record.id,
    provider: record.provider,
    import_id: record.import_id,
    ingestion_status: record.ingestion_status,
    received_at: record.received_at,
    processed_at: record.processed_at,
    created_by: record.created_by,
    created_at: record.created_at,
  };
}

async function listIngestions(env, url) {
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
  const rows = await createIngestionRepository(env.DB).list({
    limit: limit + 1,
    offset,
  });
  return jsonResponse({
    ingestions: rows.slice(0, limit),
    pagination: {
      limit,
      offset,
      has_more: rows.length > limit,
      has_previous: offset > 0,
    },
  });
}

async function getIngestion(env, ingestionId) {
  const repository = createIngestionRepository(env.DB);
  const record = await repository.findById(ingestionId);
  if (!record) {
    return jsonResponse(
      { error: "Ingestion not found", code: "INGESTION_NOT_FOUND" },
      { status: 404 },
    );
  }
  const objects = await repository.getObjects(ingestionId);
  return jsonResponse({ ingestion: publicMessage(record), objects });
}

async function createGmailIngestion(request, env, url) {
  const payload = await readJsonBody(request, { maximumBytes: MAX_REQUEST_BYTES });
  const result = await ingestGmailMessage({
    db: env.DB,
    bucket: env.SOURCE_ARCHIVE,
    payload,
  });
  const location = new URL(
    `/api/ingestions/${encodeURIComponent(result.ingestion_id)}`,
    url,
  );
  return jsonResponse(
    { result },
    { status: 201, headers: { Location: location.toString() } },
  );
}

export async function handleGmailIngestionApi(request, env, url) {
  if (!url.pathname.startsWith("/api/ingestions")) return null;
  await requireWriteAuthorization(request, env);

  if (url.pathname === "/api/ingestions/gmail") {
    if (request.method !== "POST") return methodNotAllowed(["POST"]);
    return createGmailIngestion(request, env, url);
  }

  if (url.pathname === "/api/ingestions" || url.pathname === "/api/ingestions/") {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return listIngestions(env, url);
  }

  const ingestionId = routeIdentifier(url.pathname, "/api/ingestions/");
  if (ingestionId === null) return null;
  if (request.method !== "GET") return methodNotAllowed(["GET"]);
  return getIngestion(env, ingestionId);
}
