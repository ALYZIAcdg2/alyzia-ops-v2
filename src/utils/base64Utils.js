const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

export function decodeBase64(value, { maximumBytes = 10_000_000 } = {}) {
  if (typeof value !== "string" || value === "") {
    throw new TypeError("base64 content must be a non-empty string");
  }
  const compact = value.replaceAll(/\s/gu, "");
  if (!BASE64_PATTERN.test(compact)) {
    throw new TypeError("base64 content is invalid");
  }
  const estimatedBytes = Math.floor((compact.length * 3) / 4);
  if (estimatedBytes > maximumBytes + 2) {
    throw new RangeError("decoded content exceeds the size limit");
  }
  const binary = atob(compact);
  if (binary.length > maximumBytes) {
    throw new RangeError("decoded content exceeds the size limit");
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function sha256Hex(value) {
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
