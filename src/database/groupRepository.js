import {
  assertD1Database,
  collectMappedFields,
  numberedPlaceholders,
  updateOneField,
  upsertMappedFields,
} from "./repositoryUtils.js";

const SUMMARY_COLUMNS = Object.freeze({
  group_count: "group_count",
  total_group_pax: "total_group_pax",
});

const GROUP_COLUMNS = Object.freeze({
  group_name: "group_name",
  pax_count: "pax_count",
  cabin_class: "cabin_class",
  pnr: "pnr",
  remark: "remark",
});

export function createGroupRepository(db) {
  assertD1Database(db);

  return {
    getSummary(flightId) {
      return db
        .prepare("SELECT * FROM flight_group_summary WHERE flight_id = ?1 LIMIT 1")
        .bind(flightId)
        .first();
    },

    upsertSummary(flightId, summary) {
      return upsertMappedFields({
        db,
        table: "flight_group_summary",
        uniqueColumn: "flight_id",
        uniqueValue: flightId,
        data: summary,
        columnMap: SUMMARY_COLUMNS,
      });
    },

    async getGroupsByFlightId(flightId) {
      const result = await db
        .prepare("SELECT * FROM flight_groups WHERE flight_id = ?1 ORDER BY id")
        .bind(flightId)
        .all();
      return result.results ?? [];
    },

    addGroup(flightId, group) {
      const entries = collectMappedFields(group, GROUP_COLUMNS);
      const columns = ["flight_id", ...entries.map(({ column }) => column)];
      const values = [flightId, ...entries.map(({ value }) => value)];
      const sql = `INSERT INTO flight_groups (${columns.join(", ")}) VALUES (${numberedPlaceholders(values.length).join(", ")})`;
      return db.prepare(sql).bind(...values).run();
    },

    updateGroupField(groupId, field, value) {
      return updateOneField({
        db,
        table: "flight_groups",
        whereColumn: "id",
        whereValue: groupId,
        field,
        value,
        columnMap: GROUP_COLUMNS,
      });
    },

    removeGroup(groupId) {
      return db
        .prepare("DELETE FROM flight_groups WHERE id = ?1")
        .bind(groupId)
        .run();
    },
  };
}
