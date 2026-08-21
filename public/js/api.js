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
