export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function decodeResponse(response) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(payload?.error ?? `Erreur HTTP ${response.status}`, {
      status: response.status,
      code: payload?.code,
      details: payload?.details,
    });
  }
  return payload;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    cache: "no-store",
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });
  return decodeResponse(response);
}

export function getHealth() {
  return apiRequest("/api/health");
}

export function listFlights({ query = "", limit = 25, offset = 0 } = {}) {
  const parameters = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (query.trim() !== "") {
    parameters.set("q", query.trim());
  }
  return apiRequest(`/api/flights?${parameters}`);
}

export function getFlight(flightId) {
  return apiRequest(`/api/flights/${encodeURIComponent(flightId)}`);
}

export function createFlight(model, writeToken) {
  return apiRequest("/api/flights", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${writeToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(model),
  });
}

export function listImports({
  limit = 25,
  offset = 0,
  status = "",
  mode = "",
  query = "",
} = {}) {
  const parameters = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (status) parameters.set("status", status);
  if (mode) parameters.set("mode", mode);
  if (query.trim()) parameters.set("q", query.trim());
  return apiRequest(`/api/imports?${parameters}`);
}

export function getImportSummary() {
  return apiRequest("/api/imports/summary");
}

export function getImport(importId) {
  return apiRequest(`/api/imports/${encodeURIComponent(importId)}`);
}

export function createStructuredImport({ model, context }, writeToken) {
  return apiRequest("/api/imports", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${writeToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, context }),
  });
}

export function resolveImportIssue(
  { importId, issueId, resolutionStatus, resolvedBy },
  writeToken,
) {
  return apiRequest(
    `/api/imports/${encodeURIComponent(importId)}/issues/${encodeURIComponent(issueId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${writeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resolution_status: resolutionStatus,
        resolved_by: resolvedBy,
      }),
    },
  );
}

export function previewSqSource({ sourceText, options }, writeToken) {
  return apiRequest("/api/sq/parse", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${writeToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source_text: sourceText, options }),
  });
}

export function importSqSource(
  { sourceText, sourceName, options, context },
  writeToken,
) {
  return apiRequest("/api/sq/import", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${writeToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_text: sourceText,
      source_name: sourceName,
      options,
      context,
    }),
  });
}

function authorizedHeaders(writeToken) {
  return { Authorization: `Bearer ${writeToken}` };
}

export function listIngestions({ limit = 25, offset = 0 } = {}, writeToken) {
  const parameters = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  return apiRequest(`/api/ingestions?${parameters}`, {
    headers: authorizedHeaders(writeToken),
  });
}

export function getIngestion(ingestionId, writeToken) {
  return apiRequest(`/api/ingestions/${encodeURIComponent(ingestionId)}`, {
    headers: authorizedHeaders(writeToken),
  });
}

export function archiveGmailSource(payload, writeToken) {
  return apiRequest("/api/ingestions/gmail", {
    method: "POST",
    headers: {
      ...authorizedHeaders(writeToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function getOpsSummary(writeToken) {
  return apiRequest("/api/ops/summary", {
    headers: authorizedHeaders(writeToken),
  });
}
