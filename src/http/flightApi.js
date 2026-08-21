import { createFlightCreationService } from "../services/flightCreationService.js";
import { createFlightQueryService } from "../services/flightQueryService.js";
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

function listOptions(url) {
  const query = (url.searchParams.get("q") ?? "").trim();
  if (query.length > 100) {
    throw new ValidationError("q must contain at most 100 characters", {
      field: "query.q",
    });
  }
  return {
    query,
    limit: parseInteger(url.searchParams.get("limit"), {
      field: "query.limit",
      minimum: 1,
      maximum: 100,
      fallback: 25,
    }),
    offset: parseInteger(url.searchParams.get("offset"), {
      field: "query.offset",
      minimum: 0,
      maximum: 100_000,
      fallback: 0,
    }),
  };
}

async function listFlights(env, url) {
  const result = await createFlightQueryService(env.DB).list(listOptions(url));
  return jsonResponse(result);
}

async function createFlight(request, env, url) {
  await requireWriteAuthorization(request, env);
  const input = await readJsonBody(request);
  const flight = await createFlightCreationService(env.DB).create(input);
  const location = new URL(
    `/api/flights/${encodeURIComponent(flight.flight.flight_id)}`,
    url,
  );
  return jsonResponse(
    { flight },
    {
      status: 201,
      headers: { Location: location.toString() },
    },
  );
}

async function getFlight(env, flightId) {
  const flight = await createFlightQueryService(env.DB).findById(flightId);
  return flight
    ? jsonResponse({ flight })
    : jsonResponse(
        { error: "Flight not found", code: "FLIGHT_NOT_FOUND" },
        { status: 404 },
      );
}

export async function handleFlightApi(request, env, url) {
  if (url.pathname === "/api/flights" || url.pathname === "/api/flights/") {
    if (request.method === "GET") {
      return listFlights(env, url);
    }
    if (request.method === "POST") {
      return createFlight(request, env, url);
    }
    return methodNotAllowed(["GET", "POST"]);
  }

  const flightId = routeIdentifier(url.pathname, "/api/flights/");
  if (flightId === null) {
    return null;
  }
  if (request.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }
  return getFlight(env, flightId);
}
