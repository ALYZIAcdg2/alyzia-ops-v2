import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceRoot = fileURLToPath(new URL("../../src/", import.meta.url));

function findModules(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return findModules(path);
    }
    return entry.isFile() && entry.name.endsWith(".js") ? [path] : [];
  });
}

test("every source module resolves as an ES Module", async () => {
  const modulePaths = findModules(sourceRoot);
  const modules = await Promise.all(
    modulePaths.map((path) => import(pathToFileURL(path))),
  );
  assert.equal(modules.length, modulePaths.length);
  assert.ok(modules.every((module) => module && typeof module === "object"));
});
