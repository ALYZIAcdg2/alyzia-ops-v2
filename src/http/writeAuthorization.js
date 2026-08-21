import { ServiceError } from "../services/serviceErrors.js";

const encoder = new TextEncoder();

async function digest(value) {
  return crypto.subtle.digest("SHA-256", encoder.encode(value));
}

function fallbackConstantTimeEqual(left, right) {
  const leftBytes = new Uint8Array(left);
  const rightBytes = new Uint8Array(right);
  let difference = leftBytes.byteLength ^ rightBytes.byteLength;
  const length = Math.max(leftBytes.byteLength, rightBytes.byteLength);
  for (let index = 0; index < length; index += 1) {
    difference |=
      (leftBytes[index % leftBytes.byteLength] ?? 0) ^
      (rightBytes[index % rightBytes.byteLength] ?? 0);
  }
  return difference === 0;
}

async function timingSafeEqual(left, right) {
  const [leftHash, rightHash] = await Promise.all([digest(left), digest(right)]);
  if (typeof crypto.subtle.timingSafeEqual === "function") {
    return crypto.subtle.timingSafeEqual(leftHash, rightHash);
  }
  return fallbackConstantTimeEqual(leftHash, rightHash);
}

export async function requireWriteAuthorization(request, env) {
  if (typeof env.API_WRITE_TOKEN !== "string" || env.API_WRITE_TOKEN === "") {
    throw new ServiceError("Write API is not configured", {
      code: "WRITE_API_NOT_CONFIGURED",
      status: 503,
    });
  }
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.API_WRITE_TOKEN}`;
  if (!(await timingSafeEqual(provided, expected))) {
    throw new ServiceError("Write authorization is invalid", {
      code: "WRITE_AUTHORIZATION_REQUIRED",
      status: 401,
    });
  }
}
