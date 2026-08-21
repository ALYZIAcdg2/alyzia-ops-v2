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

    async listImports({
      limit = 25,
      offset = 0,
      import_status,
      import_mode,
      query,
    } = {}) {
      const predicates = [];
      const values = [];
      if (import_status !== undefined) {
        values.push(import_status);
        predicates.push(`import_status = ?${values.length}`);
      }
      if (import_mode !== undefined) {
        values.push(import_mode);
        predicates.push(`import_mode = ?${values.length}`);
      }
      if (query !== undefined) {
        values.push(query);
        const placeholder = `?${values.length}`;
        predicates.push(`(
          instr(lower(id), lower(${placeholder})) > 0 OR
          instr(lower(COALESCE(flight_id, '')), lower(${placeholder})) > 0 OR
          instr(lower(COALESCE(parser_name, '')), lower(${placeholder})) > 0 OR
          instr(lower(COALESCE(created_by, '')), lower(${placeholder})) > 0
        )`);
      }
      const where = predicates.length === 0
        ? ""
        : `WHERE ${predicates.join(" AND ")}`;
      values.push(limit, offset);
      const result = await db
        .prepare(
          `SELECT * FROM imports
           ${where}
           ORDER BY created_at DESC, id DESC
           LIMIT ?${values.length - 1} OFFSET ?${values.length}`,
        )
        .bind(...values)
        .all();
      return result.results ?? [];
    },

    async getImportSummary() {
      return (
        (await db
          .prepare(
            `SELECT
               COUNT(*) AS total,
               SUM(CASE WHEN import_status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
               SUM(CASE WHEN import_status = 'PROCESSED' THEN 1 ELSE 0 END) AS processed,
               SUM(CASE WHEN import_status = 'NO_CHANGE' THEN 1 ELSE 0 END) AS no_change,
               SUM(CASE WHEN import_status = 'REVIEW_REQUIRED' THEN 1 ELSE 0 END) AS review_required,
               SUM(CASE WHEN import_status = 'ERROR' THEN 1 ELSE 0 END) AS error,
               (SELECT COUNT(*) FROM import_issues WHERE resolution_status = 'OPEN') AS open_issues
             FROM imports`,
          )
          .first()) ?? {
          total: 0,
          pending: 0,
          processed: 0,
          no_change: 0,
          review_required: 0,
          error: 0,
          open_issues: 0,
        }
      );
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

    resolveImportIssue(
      importId,
      issueId,
      { resolution_status, resolved_by, resolved_at } = {},
    ) {
      return db
        .prepare(
          `UPDATE import_issues
           SET resolution_status = ?1,
               resolved_by = ?2,
               resolved_at = COALESCE(?3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
           WHERE id = ?4 AND import_id = ?5`,
        )
        .bind(
          resolution_status,
          resolved_by,
          resolved_at ?? null,
          issueId,
          importId,
        )
        .run();
    },
  };
}
