import {
  assertD1Database,
  collectMappedFields,
  numberedPlaceholders,
} from "./repositoryUtils.js";

const HISTORY_COLUMNS = Object.freeze({
  flight_id: "flight_id",
  import_id: "import_id",
  entity_type: "entity_type",
  entity_id: "entity_id",
  field_path: "field_path",
  old_value: "old_value",
  new_value: "new_value",
  change_source: "change_source",
  change_action: "change_action",
  changed_by: "changed_by",
  changed_at: "changed_at",
});

export function createHistoryRepository(db) {
  assertD1Database(db);

  return {
    add(historyEntry) {
      const entries = collectMappedFields(historyEntry, HISTORY_COLUMNS);
      const sql = `INSERT INTO field_history (${entries.map(({ column }) => column).join(", ")}) VALUES (${numberedPlaceholders(entries.length).join(", ")})`;
      return db
        .prepare(sql)
        .bind(...entries.map(({ value }) => value))
        .run();
    },

    async getByFlightId(flightId) {
      const result = await db
        .prepare(
          "SELECT * FROM field_history WHERE flight_id = ?1 ORDER BY changed_at, id",
        )
        .bind(flightId)
        .all();
      return result.results ?? [];
    },

    async getByImportId(importId) {
      const result = await db
        .prepare(
          "SELECT * FROM field_history WHERE import_id = ?1 ORDER BY changed_at, id",
        )
        .bind(importId)
        .all();
      return result.results ?? [];
    },
  };
}
