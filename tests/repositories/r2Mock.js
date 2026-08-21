export function createR2Mock() {
  const objects = new Map();
  return {
    bucket: {
      async put(key, value, options = {}) {
        objects.set(key, {
          bytes: new Uint8Array(value),
          httpMetadata: options.httpMetadata,
          customMetadata: options.customMetadata,
        });
        return { key };
      },
      async delete(key) {
        objects.delete(key);
      },
      async get(key) {
        return objects.get(key) ?? null;
      },
    },
    objects,
  };
}
