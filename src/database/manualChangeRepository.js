import {
  assertD1Database,
  collectMappedFields,
  numberedPlaceholders,
} from "./repositoryUtils.js";

const MANUAL_CHANGE_COLUMNS = Object.freeze({
  flight_id: "flight_id",
  entity_type: "entity_type",
  entity_id: "entity_id",
  field_path: "field_path",
  old_value: "old_value",
  new_value: "new_value",
  override_type: "override_type",
  active: "active",
  changed_by: "changed_by",
  reason: "reason",
  created_at: "created_at",
  deactivated_at: "deactivated_at",
  deactivated_by: "deactivated_by",
});

export function createManualChangeRepository(db) {
  assertD1Database(db);

  return {
    async getActiveByFlightId(flightId) {
      const result = await db
        .prepare(
          `SELECT * FROM manual_changes
           WHERE flight_id = ?1 AND active = 1
           ORDER BY created_at, id`,
        )
        .bind(flightId)
        .all();
      return result.results ?? [];
    },

    async getAllByFlightId(flightId) {
      const result = await db
        .prepare(
          "SELECT * FROM manual_changes WHERE flight_id = ?1 ORDER BY created_at, id",
        )
        .bind(flightId)
        .all();
      return result.results ?? [];
    },

    create(change) {
      const entries = collectMappedFields(change, MANUAL_CHANGE_COLUMNS);
      const sql = `INSERT INTO manual_changes (${entries.map(({ column }) => column).join(", ")}) VALUES (${numberedPlaceholders(entries.length).join(", ")})`;
      return db
        .prepare(sql)
        .bind(...entries.map(({ value }) => value))
        .run();
    },

    deactivate(changeId, { deactivated_by, deactivated_at } = {}) {
      return db
        .prepare(
          `UPDATE manual_changes
           SET active = 0,
               deactivated_by = ?1,
               deactivated_at = COALESCE(?2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
           WHERE id = ?3`,
        )
        .bind(deactivated_by ?? null, deactivated_at ?? null, changeId)
        .run();
    },
  };
}
