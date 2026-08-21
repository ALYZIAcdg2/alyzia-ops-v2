import { assertD1Database } from "./repositoryUtils.js";

const TIMING_COLUMNS = Object.freeze({
  std: "std",
  etd: "etd",
  atd: "atd",
  boarding_time: "boarding_time",
  flight_status: "flight_status",
  acceptance_status: "acceptance_status",
  status_validated_at: "status_validated_at",
  status_validated_by: "status_validated_by",
});
const AIRCRAFT_COLUMNS = Object.freeze({ type: "aircraft_type", seatmap_id: "seatmap_id" });
const GROUP_SUMMARY_COLUMNS = Object.freeze({
  group_count: "group_count",
  total_group_pax: "total_group_pax",
});

function column(map, field) {
  const result = map[field];
  if (!result) {
    throw new RangeError(`unsupported import field: ${field}`);
  }
  return result;
}

function statementForOperation(db, flightId, operation) {
  switch (operation.type) {
    case "UPDATE_FLIGHT_RAW_DATE":
      return db.prepare(
        "UPDATE flights SET service_date_raw = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?2",
      ).bind(operation.value, flightId);
    case "UPSERT_TIMING_FIELD": {
      const field = column(TIMING_COLUMNS, operation.field);
      return db.prepare(
        `INSERT INTO flight_timings (flight_id, ${field}) VALUES (?1, ?2)
         ON CONFLICT(flight_id) DO UPDATE SET ${field} = excluded.${field}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      ).bind(flightId, operation.value);
    }
    case "UPSERT_AIRCRAFT_FIELD": {
      const field = column(AIRCRAFT_COLUMNS, operation.field);
      return db.prepare(
        `INSERT INTO flight_aircraft (flight_id, ${field}) VALUES (?1, ?2)
         ON CONFLICT(flight_id) DO UPDATE SET ${field} = excluded.${field}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      ).bind(flightId, operation.value);
    }
    case "UPSERT_CABIN_CLASS":
      return db.prepare(
        `INSERT INTO flight_cabin_configuration (flight_id, class_code, capacity) VALUES (?1, ?2, ?3)
         ON CONFLICT(flight_id, class_code) DO UPDATE SET capacity = excluded.capacity, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      ).bind(flightId, operation.class_code, operation.value);
    case "REMOVE_CABIN_CLASS":
      return db.prepare(
        "DELETE FROM flight_cabin_configuration WHERE flight_id = ?1 AND class_code = ?2",
      ).bind(flightId, operation.class_code);
    case "UPSERT_LOAD_CLASS":
      return db.prepare(
        `INSERT INTO flight_load (flight_id, load_type, class_code, value) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(flight_id, load_type, class_code) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      ).bind(flightId, operation.load_type, operation.class_code, operation.value);
    case "REMOVE_LOAD_CLASS":
      return db.prepare(
        "DELETE FROM flight_load WHERE flight_id = ?1 AND load_type = ?2 AND class_code = ?3",
      ).bind(flightId, operation.load_type, operation.class_code);
    case "UPSERT_LOAD_TOTAL":
      return db.prepare(
        `INSERT INTO flight_load_totals (flight_id, metric, value) VALUES (?1, ?2, ?3)
         ON CONFLICT(flight_id, metric) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      ).bind(flightId, operation.metric, operation.value);
    case "REMOVE_LOAD_TOTAL":
      return db.prepare(
        "DELETE FROM flight_load_totals WHERE flight_id = ?1 AND metric = ?2",
      ).bind(flightId, operation.metric);
    case "UPSERT_GROUP_SUMMARY_FIELD": {
      const field = column(GROUP_SUMMARY_COLUMNS, operation.field);
      return db.prepare(
        `INSERT INTO flight_group_summary (flight_id, ${field}) VALUES (?1, ?2)
         ON CONFLICT(flight_id) DO UPDATE SET ${field} = excluded.${field}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      ).bind(flightId, operation.value);
    }
    default:
      throw new RangeError(`unsupported import operation: ${operation.type}`);
  }
}

function historyStatement(db, entry) {
  return db.prepare(
    `INSERT INTO field_history
      (flight_id, import_id, entity_type, entity_id, field_path, old_value, new_value, change_source, change_action, changed_by, changed_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'IMPORT', ?8, ?9, ?10)`,
  ).bind(
    entry.flight_id,
    entry.import_id,
    entry.entity_type,
    entry.entity_id,
    entry.field_path,
    entry.old_value,
    entry.new_value,
    entry.change_action,
    entry.changed_by,
    entry.changed_at,
  );
}

export function createImportExecutionRepository(db) {
  assertD1Database(db);
  if (typeof db.batch !== "function") {
    throw new TypeError("D1 batch support is required for atomic imports");
  }
  return {
    executeAtomically(flightId, operations, historyEntries) {
      const statements = [
        ...operations.map((operation) => statementForOperation(db, flightId, operation)),
        ...historyEntries.map((entry) => historyStatement(db, entry)),
      ];
      return statements.length === 0 ? Promise.resolve([]) : db.batch(statements);
    },
  };
}

