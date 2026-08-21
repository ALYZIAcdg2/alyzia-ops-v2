import { handleFlightApi } from "./http/flightApi.js";
import { handleImportApi } from "./http/importApi.js";
import { handleSqParserApi } from "./http/sqParserApi.js";
import {
  jsonResponse,
  methodNotAllowed,
} from "./http/httpUtils.js";
import { ServiceError } from "./services/serviceErrors.js";

const SERVICE_NAME = "ALYZIA OPS";
const SERVICE_VERSION = "0.6.0";

const ASSET_SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

async function serveAsset(request, assets) {
  const response = await assets.fetch(request);
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(ASSET_SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (url.pathname === "/api/health") {
    if (request.method !== "GET") {
      return methodNotAllowed(["GET"]);
    }
    return jsonResponse({
      ok: true,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
    });
  }

  const flightResponse = await handleFlightApi(request, env, url);
  if (flightResponse) {
    return flightResponse;
  }

  const importResponse = await handleImportApi(request, env, url);
  if (importResponse) {
    return importResponse;
  }

  const sqParserResponse = await handleSqParserApi(request, env, url);
  if (sqParserResponse) {
    return sqParserResponse;
  }

  if (url.pathname.startsWith("/api/")) {
    return jsonResponse({ error: "Not found" }, { status: 404 });
  }

  if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
    return serveAsset(request, env.ASSETS);
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
      if (error instanceof ServiceError) {
        return jsonResponse(
          {
            error: error.message,
            code: error.code,
            ...(error.details === undefined ? {} : { details: error.details }),
          },
          { status: error.status },
        );
      }
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
