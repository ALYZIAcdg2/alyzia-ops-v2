import test from "node:test";
import assert from "node:assert/strict";

import { getOpsSummary } from "../../src/services/opsSupervisionService.js";
import { createSQLiteD1 } from "../repositories/sqliteD1.js";

test("supervision reports fixed D1 metrics and configured bindings", async () => {
  const database = createSQLiteD1();
  try {
    await database.db
      .prepare(
        `INSERT INTO imports (
           id, import_mode, import_status, parser_name, created_by
         ) VALUES (?1, 'MANUAL', 'ERROR', 'fixture-parser', 'FIXTURE_USER')`,
      )
      .bind("IMPORT-OPS-FIXTURE")
      .run();
    const result = await getOpsSummary({
      db: database.db,
      bindings: { r2: true, queues: false },
    });

    assert.equal(result.status, "ATTENTION_REQUIRED");
    assert.equal(result.summary.imports, 1);
    assert.equal(result.summary.imports_error, 1);
    assert.deepEqual(result.bindings, { d1: true, r2: true, queues: false });
    assert.ok(result.extensions.some((extension) => extension.id === "sq-editing"));
    assert.ok(result.extensions.some((extension) => extension.status === "PLANNED"));
  } finally {
    database.close();
  }
});
