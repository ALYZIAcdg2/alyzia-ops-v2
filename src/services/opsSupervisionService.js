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
