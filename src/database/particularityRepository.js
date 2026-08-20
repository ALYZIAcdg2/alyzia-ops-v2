import { assertD1Database } from "./repositoryUtils.js";

export function createParticularityRepository(db) {
  assertD1Database(db);

  return {
    async getPassengerParticularities(passengerId) {
      const result = await db
        .prepare(
          "SELECT * FROM passenger_particularities WHERE passenger_id = ?1 ORDER BY id",
        )
        .bind(passengerId)
        .all();
      return result.results ?? [];
    },

    async getFlightParticularityCounts(flightId) {
      const result = await db
        .prepare(
          "SELECT * FROM flight_particularity_counts WHERE flight_id = ?1 ORDER BY id",
        )
        .bind(flightId)
        .all();
      return result.results ?? [];
    },

    addPassengerParticularity(passengerId, category, code) {
      return db
        .prepare(
          `INSERT INTO passenger_particularities (passenger_id, category, code)
           VALUES (?1, ?2, ?3)
           ON CONFLICT(passenger_id, category, code) DO NOTHING`,
        )
        .bind(passengerId, category, code)
        .run();
    },

    removePassengerParticularity(passengerId, category, code) {
      return db
        .prepare(
          `DELETE FROM passenger_particularities
           WHERE passenger_id = ?1 AND category = ?2 AND code = ?3`,
        )
        .bind(passengerId, category, code)
        .run();
    },

    upsertFlightCount(flightId, category, code, paxCount) {
      return db
        .prepare(
          `INSERT INTO flight_particularity_counts (flight_id, category, code, pax_count)
           VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT(flight_id, category, code) DO UPDATE SET
             pax_count = excluded.pax_count,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        )
        .bind(flightId, category, code, paxCount)
        .run();
    },

    removeFlightCount(flightId, category, code) {
      return db
        .prepare(
          `DELETE FROM flight_particularity_counts
           WHERE flight_id = ?1 AND category = ?2 AND code = ?3`,
        )
        .bind(flightId, category, code)
        .run();
    },
  };
}
