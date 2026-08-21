import { createOpsRepository } from "../database/opsRepository.js";
import { listExtensions } from "../extensions/extensionRegistry.js";

function numericSummary(row) {
  return Object.fromEntries(
    Object.entries(row ?? {}).map(([key, value]) => [key, Number(value ?? 0)]),
  );
}

export async function getOpsSummary({ db, bindings = {} }) {
  const summary = numericSummary(await createOpsRepository(db).getSummary());
  return {
    status:
      summary.imports_error > 0 || summary.ingestions_error > 0
        ? "ATTENTION_REQUIRED"
        : "OPERATIONAL",
    generated_at: new Date().toISOString(),
    bindings: {
      d1: true,
      r2: bindings.r2 === true,
      queues: bindings.queues === true,
    },
    summary,
    extensions: listExtensions(),
  };
}

export async function getReadiness({ db, bindings = {} }) {
  try {
    const schema = await createOpsRepository(db).getIngestionSchemaState();
    const ingestionSchema = Number(schema?.table_count ?? 0) === 2;
    const r2 = bindings.r2 === true;
    return {
      ok: ingestionSchema && r2,
      dependencies: { d1: true, ingestion_schema: ingestionSchema, r2 },
    };
  } catch {
    return {
      ok: false,
      dependencies: { d1: false, ingestion_schema: false, r2: bindings.r2 === true },
    };
  }
}
