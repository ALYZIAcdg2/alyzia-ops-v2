import {
  assertD1Database,
  collectMappedFields,
  numberedPlaceholders,
  updateOneField,
} from "./repositoryUtils.js";

const PASSENGER_COLUMNS = Object.freeze({
  passenger_name_raw: "passenger_name_raw",
  passenger_name_normalized: "passenger_name_normalized",
  passenger_type: "passenger_type",
  parent_passenger_id: "parent_passenger_id",
  cabin_class: "cabin_class",
  booking_class: "booking_class",
  seat: "seat",
  remark: "remark",
});

export function createPassengerRepository(db) {
  assertD1Database(db);

  return {
    async getByFlightId(flightId) {
      const result = await db
        .prepare("SELECT * FROM flight_passengers WHERE flight_id = ?1 ORDER BY id")
        .bind(flightId)
        .all();
      return result.results ?? [];
    },

    findById(passengerId) {
      return db
        .prepare("SELECT * FROM flight_passengers WHERE id = ?1 LIMIT 1")
        .bind(passengerId)
        .first();
    },

    findByEtkt(flightId, etktNumber) {
      return db
        .prepare(
          `SELECT passenger.*
           FROM flight_passengers AS passenger
           INNER JOIN passenger_tickets AS ticket
             ON ticket.passenger_id = passenger.id
           WHERE ticket.flight_id = ?1 AND ticket.etkt_number = ?2
           LIMIT 1`,
        )
        .bind(flightId, etktNumber)
        .first();
    },

    findByNameAndSeat(flightId, normalizedName, seat) {
      return db
        .prepare(
          `SELECT * FROM flight_passengers
           WHERE flight_id = ?1
             AND passenger_name_normalized = ?2
             AND seat = ?3
           ORDER BY id`,
        )
        .bind(flightId, normalizedName, seat)
        .all()
        .then((result) => result.results ?? []);
    },

    findByNameAndCabin(flightId, normalizedName, cabinClass) {
      return db
        .prepare(
          `SELECT * FROM flight_passengers
           WHERE flight_id = ?1
             AND passenger_name_normalized = ?2
             AND cabin_class = ?3
           ORDER BY id`,
        )
        .bind(flightId, normalizedName, cabinClass)
        .all()
        .then((result) => result.results ?? []);
    },

    create(flightId, passenger) {
      const entries = collectMappedFields(passenger, PASSENGER_COLUMNS);
      const columns = ["flight_id", ...entries.map(({ column }) => column)];
      const values = [flightId, ...entries.map(({ value }) => value)];
      const sql = `INSERT INTO flight_passengers (${columns.join(", ")}) VALUES (${numberedPlaceholders(values.length).join(", ")})`;
      return db.prepare(sql).bind(...values).run();
    },

    updateField(passengerId, field, value) {
      return updateOneField({
        db,
        table: "flight_passengers",
        whereColumn: "id",
        whereValue: passengerId,
        field,
        value,
        columnMap: PASSENGER_COLUMNS,
      });
    },

    remove(passengerId) {
      return db
        .prepare("DELETE FROM flight_passengers WHERE id = ?1")
        .bind(passengerId)
        .run();
    },
  };
}
