import { createFlightRepository } from "./database/flightRepository.js";
import { createImportRepository } from "./database/importRepository.js";

const SERVICE_NAME = "ALYZIA OPS";
const SERVICE_VERSION = "0.1.0";

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

function routeIdentifier(pathname, prefix) {
  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const encodedId = pathname.slice(prefix.length);
  if (!encodedId || encodedId.includes("/")) {
    return null;
  }

  try {
    return decodeURIComponent(encodedId);
  } catch {
    return null;
  }
}

async function handleFlightRequest(env, flightId) {
  const flight = await createFlightRepository(env.DB).findById(flightId);

  return flight
    ? jsonResponse({ flight })
    : jsonResponse({ error: "Flight not found" }, { status: 404 });
}

async function handleImportRequest(env, importId) {
  const repository = createImportRepository(env.DB);
  const [importRecord, sources, issues] = await Promise.all([
    repository.getImportById(importId),
    repository.getSourcesByImportId(importId),
    repository.getIssuesByImportId(importId),
  ]);

  return importRecord
    ? jsonResponse({ import: importRecord, sources, issues })
    : jsonResponse({ error: "Import not found" }, { status: 404 });
}

async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return jsonResponse(
      { error: "Method not allowed" },
      { status: 405, headers: { Allow: "GET" } },
    );
  }

  if (url.pathname === "/api/health") {
    return jsonResponse({
      ok: true,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
    });
  }

  const flightId = routeIdentifier(url.pathname, "/api/flights/");
  if (flightId !== null) {
    return handleFlightRequest(env, flightId);
  }

  const importId = routeIdentifier(url.pathname, "/api/imports/");
  if (importId !== null) {
    return handleImportRequest(env, importId);
  }

  if (url.pathname.startsWith("/api/")) {
    return jsonResponse({ error: "Not found" }, { status: 404 });
  }

  if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
    return env.ASSETS.fetch(request);
  }

  return new Response("ALYZIA OPS foundation", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error(
        JSON.stringify({
          message: "request failed",
          error: error instanceof Error ? error.message : String(error),
          path: new URL(request.url).pathname,
        }),
      );
      return jsonResponse({ error: "Internal server error" }, { status: 500 });
    }
  },
};
