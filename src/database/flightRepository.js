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

function escapeLikePattern(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

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

    async list({ query, limit, offset }) {
      const hasQuery = typeof query === "string" && query.length > 0;
      const whereClause = hasQuery
        ? `WHERE UPPER(flight.id) LIKE ?1 ESCAPE '\\'
             OR UPPER(flight.airline || flight.flight_number) LIKE ?1 ESCAPE '\\'
             OR UPPER(flight.origin) LIKE ?1 ESCAPE '\\'
             OR UPPER(flight.destination) LIKE ?1 ESCAPE '\\'
             OR flight.service_date_internal LIKE ?1 ESCAPE '\\'`
        : "";
      const limitPlaceholder = hasQuery ? "?2" : "?1";
      const offsetPlaceholder = hasQuery ? "?3" : "?2";
      const sql = `SELECT
          flight.*,
          timing.id AS timing_id,
          timing.std,
          timing.etd,
          timing.atd,
          timing.boarding_time,
          timing.flight_status,
          timing.acceptance_status,
          aircraft.id AS aircraft_id,
          aircraft.aircraft_type
        FROM flights AS flight
        LEFT JOIN flight_timings AS timing ON timing.flight_id = flight.id
        LEFT JOIN flight_aircraft AS aircraft ON aircraft.flight_id = flight.id
        ${whereClause}
        ORDER BY flight.service_date_internal DESC, flight.airline, flight.flight_number
        LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;
      const values = hasQuery
        ? [`%${escapeLikePattern(query.toUpperCase())}%`, limit, offset]
        : [limit, offset];
      const result = await db.prepare(sql).bind(...values).all();
      return result.results ?? [];
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

    remove(flightId) {
      return db.prepare("DELETE FROM flights WHERE id = ?1").bind(flightId).run();
    },
  };
}
