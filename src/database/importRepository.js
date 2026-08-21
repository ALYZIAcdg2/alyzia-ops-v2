import {
  assertD1Database,
  collectMappedFields,
  numberedPlaceholders,
} from "./repositoryUtils.js";

const IMPORT_COLUMNS = Object.freeze({
  id: "id",
  flight_id: "flight_id",
  import_mode: "import_mode",
  import_status: "import_status",
  data_scope: "data_scope",
  parser_name: "parser_name",
  parser_version: "parser_version",
  started_at: "started_at",
  completed_at: "completed_at",
  created_by: "created_by",
});

const SOURCE_COLUMNS = Object.freeze({
  source_type: "source_type",
  source_name: "source_name",
  source_document: "source_document",
  detected_type: "detected_type",
  detection_confidence: "detection_confidence",
  source_timestamp: "source_timestamp",
  file_status: "file_status",
});

const ISSUE_COLUMNS = Object.freeze({
  severity: "severity",
  issue_code: "issue_code",
  field_path: "field_path",
  current_value: "current_value",
  incoming_value: "incoming_value",
  message: "message",
  resolution_status: "resolution_status",
  resolved_by: "resolved_by",
  resolved_at: "resolved_at",
});

function insertMapped(db, table, requiredColumns, data, columnMap) {
  const entries = collectMappedFields(data, columnMap);
  const columns = [...requiredColumns.keys(), ...entries.map(({ column }) => column)];
  const values = [...requiredColumns.values(), ...entries.map(({ value }) => value)];
  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${numberedPlaceholders(values.length).join(", ")})`;
  return db.prepare(sql).bind(...values).run();
}

export function createImportRepository(db) {
  assertD1Database(db);

  return {
    createImport(importData) {
      if (!Object.hasOwn(importData, "id")) {
        throw new TypeError("import id is required");
      }
      return insertMapped(db, "imports", new Map(), importData, IMPORT_COLUMNS);
    },

    updateImportStatus(importId, importStatus, { completed_at } = {}) {
      if (completed_at === undefined) {
        return db
          .prepare(
            "UPDATE imports SET import_status = ?1 WHERE id = ?2",
          )
          .bind(importStatus, importId)
          .run();
      }

      return db
        .prepare(
          "UPDATE imports SET import_status = ?1, completed_at = ?2 WHERE id = ?3",
        )
        .bind(importStatus, completed_at, importId)
        .run();
    },

    attachFlight(importId, flightId) {
      return db
        .prepare("UPDATE imports SET flight_id = ?1 WHERE id = ?2")
        .bind(flightId, importId)
        .run();
    },

    getImportById(importId) {
      return db
        .prepare("SELECT * FROM imports WHERE id = ?1 LIMIT 1")
        .bind(importId)
        .first();
    },

    async listImports({ limit = 25, offset = 0 } = {}) {
      const result = await db
        .prepare(
          `SELECT * FROM imports
           ORDER BY created_at DESC, id DESC
           LIMIT ?1 OFFSET ?2`,
        )
        .bind(limit, offset)
        .all();
      return result.results ?? [];
    },

    addSource(importId, source) {
      return insertMapped(
        db,
        "import_sources",
        new Map([["import_id", importId]]),
        source,
        SOURCE_COLUMNS,
      );
    },

    async getSourcesByImportId(importId) {
      const result = await db
        .prepare("SELECT * FROM import_sources WHERE import_id = ?1 ORDER BY id")
        .bind(importId)
        .all();
      return result.results ?? [];
    },

    addIssue(importId, issue) {
      return insertMapped(
        db,
        "import_issues",
        new Map([["import_id", importId]]),
        issue,
        ISSUE_COLUMNS,
      );
    },

    async getIssuesByImportId(importId) {
      const result = await db
        .prepare("SELECT * FROM import_issues WHERE import_id = ?1 ORDER BY id")
        .bind(importId)
        .all();
      return result.results ?? [];
    },

    resolveIssue(
      issueId,
      { resolution_status = "RESOLVED", resolved_by, resolved_at } = {},
    ) {
      return db
        .prepare(
          `UPDATE import_issues
           SET resolution_status = ?1,
               resolved_by = ?2,
               resolved_at = COALESCE(?3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
           WHERE id = ?4`,
        )
        .bind(
          resolution_status,
          resolved_by ?? null,
          resolved_at ?? null,
          issueId,
        )
        .run();
    },
  };
}
