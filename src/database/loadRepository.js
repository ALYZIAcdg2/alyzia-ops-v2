import { assertD1Database } from "./repositoryUtils.js";

export function createLoadRepository(db) {
  assertD1Database(db);

  return {
    async getByFlightId(flightId) {
      const result = await db
        .prepare("SELECT * FROM flight_load WHERE flight_id = ?1 ORDER BY id")
        .bind(flightId)
        .all();
      return result.results ?? [];
    },

    async getTotalsByFlightId(flightId) {
      const result = await db
        .prepare(
          "SELECT * FROM flight_load_totals WHERE flight_id = ?1 ORDER BY id",
        )
        .bind(flightId)
        .all();
      return result.results ?? [];
    },

    upsertClassValue(flightId, loadType, classCode, value) {
      return db
        .prepare(
          `INSERT INTO flight_load (flight_id, load_type, class_code, value)
           VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT(flight_id, load_type, class_code) DO UPDATE SET
             value = excluded.value,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        )
        .bind(flightId, loadType, classCode, value)
        .run();
    },

    removeClassValue(flightId, loadType, classCode) {
      return db
        .prepare(
          "DELETE FROM flight_load WHERE flight_id = ?1 AND load_type = ?2 AND class_code = ?3",
        )
        .bind(flightId, loadType, classCode)
        .run();
    },

    upsertTotal(flightId, metric, value) {
      return db
        .prepare(
          `INSERT INTO flight_load_totals (flight_id, metric, value)
           VALUES (?1, ?2, ?3)
           ON CONFLICT(flight_id, metric) DO UPDATE SET
             value = excluded.value,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        )
        .bind(flightId, metric, value)
        .run();
    },

    removeTotal(flightId, metric) {
      return db
        .prepare(
          "DELETE FROM flight_load_totals WHERE flight_id = ?1 AND metric = ?2",
        )
        .bind(flightId, metric)
        .run();
    },
  };
}
