import {
  assertD1Database,
  collectMappedFields,
  numberedPlaceholders,
  updateOneField,
} from "./repositoryUtils.js";

const CREATE_COLUMNS = Object.freeze({
  flight_id: "id",
  airline: "airline",
  flight_number: "flight_number",
  service_date_raw: "service_date_raw",
  service_date_internal: "service_date_internal",
  origin: "origin",
  destination: "destination",
  movement_type: "movement_type",
});

const UPDATE_COLUMNS = Object.freeze({
  service_date_raw: "service_date_raw",
});

export function createFlightRepository(db) {
  assertD1Database(db);

  return {
    findById(flightId) {
      return db.prepare("SELECT * FROM flights WHERE id = ?1 LIMIT 1").bind(
        flightId,
      ).first();
    },

    findExact({
      airline,
      flight_number,
      service_date_internal,
      origin,
      destination,
    }) {
      return db
        .prepare(
          `SELECT * FROM flights
           WHERE airline = ?1
             AND flight_number = ?2
             AND service_date_internal = ?3
             AND origin = ?4
             AND destination = ?5
           LIMIT 1`,
        )
        .bind(
          airline,
          flight_number,
          service_date_internal,
          origin,
          destination,
        )
        .first();
    },

    create(data) {
      if (!Object.hasOwn(data, "flight_id")) {
        throw new TypeError("flight_id is required");
      }

      const entries = collectMappedFields(data, CREATE_COLUMNS);
      const sql = `INSERT INTO flights (${entries.map(({ column }) => column).join(", ")}) VALUES (${numberedPlaceholders(entries.length).join(", ")})`;
      return db
        .prepare(sql)
        .bind(...entries.map(({ value }) => value))
        .run();
    },

    updateServiceDateRaw(flightId, serviceDateRaw) {
      return updateOneField({
        db,
        table: "flights",
        whereColumn: "id",
        whereValue: flightId,
        field: "service_date_raw",
        value: serviceDateRaw,
        columnMap: UPDATE_COLUMNS,
      });
    },
  };
}
