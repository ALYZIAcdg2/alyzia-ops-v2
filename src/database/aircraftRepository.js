import {
  assertD1Database,
  updateOneField,
  upsertMappedFields,
} from "./repositoryUtils.js";

const AIRCRAFT_COLUMNS = Object.freeze({
  type: "aircraft_type",
  seatmap_id: "seatmap_id",
});

export function createAircraftRepository(db) {
  assertD1Database(db);

  return {
    findByFlightId(flightId) {
      return db
        .prepare("SELECT * FROM flight_aircraft WHERE flight_id = ?1 LIMIT 1")
        .bind(flightId)
        .first();
    },

    upsertAircraft(flightId, aircraft) {
      return upsertMappedFields({
        db,
        table: "flight_aircraft",
        uniqueColumn: "flight_id",
        uniqueValue: flightId,
        data: aircraft,
        columnMap: AIRCRAFT_COLUMNS,
      });
    },

    updateAircraftField(flightId, field, value) {
      return updateOneField({
        db,
        table: "flight_aircraft",
        whereColumn: "flight_id",
        whereValue: flightId,
        field,
        value,
        columnMap: AIRCRAFT_COLUMNS,
      });
    },

    async getCabinConfiguration(flightId) {
      const result = await db
        .prepare(
          "SELECT * FROM flight_cabin_configuration WHERE flight_id = ?1 ORDER BY id",
        )
        .bind(flightId)
        .all();
      return result.results ?? [];
    },

    upsertCabinClass(flightId, { class: classCode, capacity }) {
      return db
        .prepare(
          `INSERT INTO flight_cabin_configuration (flight_id, class_code, capacity)
           VALUES (?1, ?2, ?3)
           ON CONFLICT(flight_id, class_code) DO UPDATE SET
             capacity = excluded.capacity,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        )
        .bind(flightId, classCode, capacity)
        .run();
    },

    removeCabinClass(flightId, classCode) {
      return db
        .prepare(
          "DELETE FROM flight_cabin_configuration WHERE flight_id = ?1 AND class_code = ?2",
        )
        .bind(flightId, classCode)
        .run();
    },

    replaceCabinConfiguration(flightId, cabinConfiguration) {
      if (!Array.isArray(cabinConfiguration)) {
        throw new TypeError("cabinConfiguration must be an array");
      }
      if (typeof db.batch !== "function") {
        throw new TypeError("D1 batch support is required");
      }

      const statements = [
        db
          .prepare("DELETE FROM flight_cabin_configuration WHERE flight_id = ?1")
          .bind(flightId),
        ...cabinConfiguration.map((entry) =>
          db
            .prepare(
              `INSERT INTO flight_cabin_configuration (flight_id, class_code, capacity)
               VALUES (?1, ?2, ?3)`,
            )
            .bind(flightId, entry.class, entry.capacity),
        ),
      ];

      return db.batch(statements);
    },
  };
}
