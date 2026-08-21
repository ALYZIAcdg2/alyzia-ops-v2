import { assertD1Database } from "./repositoryUtils.js";

export function createOpsRepository(db) {
  assertD1Database(db);

  return {
    getSummary() {
      return db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM flights) AS flights,
             (SELECT COUNT(*) FROM imports) AS imports,
             (SELECT COUNT(*) FROM imports WHERE import_status = 'REVIEW_REQUIRED') AS imports_review,
             (SELECT COUNT(*) FROM imports WHERE import_status = 'ERROR') AS imports_error,
             (SELECT COUNT(*) FROM import_issues WHERE resolution_status = 'OPEN') AS open_issues,
             (SELECT COUNT(*) FROM manual_changes WHERE active = 1) AS active_overrides,
             (SELECT COUNT(*) FROM ingestion_messages) AS ingestions,
             (SELECT COUNT(*) FROM ingestion_messages WHERE ingestion_status = 'REVIEW_REQUIRED') AS ingestions_review,
             (SELECT COUNT(*) FROM ingestion_messages WHERE ingestion_status = 'ERROR') AS ingestions_error,
             (SELECT COUNT(*) FROM ingestion_objects) AS archived_objects`,
        )
        .first();
    },
  };
}
