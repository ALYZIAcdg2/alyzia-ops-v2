const EXTENSIONS = Object.freeze([
  Object.freeze({
    id: "sq-editing",
    extension_type: "PARSER",
    version: "0.1.0",
    status: "ACTIVE",
  }),
  Object.freeze({
    id: "gmail-relay",
    extension_type: "INGESTION",
    version: "0.1.0",
    status: "ACTIVE",
  }),
  Object.freeze({
    id: "queue-ingestion",
    extension_type: "INGESTION",
    version: null,
    status: "PLANNED",
  }),
]);

export function listExtensions() {
  return EXTENSIONS.map((extension) => ({ ...extension }));
}

export function findExtension(extensionId) {
  const extension = EXTENSIONS.find((item) => item.id === extensionId);
  return extension ? { ...extension } : null;
}
