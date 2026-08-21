import { ValidationError } from "../services/serviceErrors.js";

export function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

export function methodNotAllowed(allowedMethods) {
  return jsonResponse(
    { error: "Method not allowed", code: "METHOD_NOT_ALLOWED" },
    {
      status: 405,
      headers: { Allow: allowedMethods.join(", ") },
    },
  );
}

export function routeIdentifier(pathname, prefix) {
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

function assertJsonContentType(request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ValidationError("Content-Type must be application/json", {
      field: "headers.content-type",
    });
  }
}

export async function readJsonBody(request, { maximumBytes = 512_000 } = {}) {
  assertJsonContentType(request);
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new ValidationError("JSON payload is too large", {
      field: "body",
      maximum_bytes: maximumBytes,
    });
  }
  if (!request.body) {
    throw new ValidationError("JSON payload is required", { field: "body" });
  }

  const reader = request.body.getReader();
  const chunks = [];
  let receivedBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    receivedBytes += value.byteLength;
    if (receivedBytes > maximumBytes) {
      await reader.cancel("payload limit exceeded");
      throw new ValidationError("JSON payload is too large", {
        field: "body",
        maximum_bytes: maximumBytes,
      });
    }
    chunks.push(value);
  }

  const payload = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(payload));
  } catch {
    throw new ValidationError("Body contains invalid JSON", { field: "body" });
  }
}
