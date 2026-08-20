import {
  assertD1Database,
  updateOneField,
  upsertMappedFields,
} from "./repositoryUtils.js";

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

export function createTimingRepository(db) {
  assertD1Database(db);

  return {
    findByFlightId(flightId) {
      return db
        .prepare("SELECT * FROM flight_timings WHERE flight_id = ?1 LIMIT 1")
        .bind(flightId)
        .first();
    },

    upsert(flightId, timings) {
      return upsertMappedFields({
        db,
        table: "flight_timings",
        uniqueColumn: "flight_id",
        uniqueValue: flightId,
        data: timings,
        columnMap: TIMING_COLUMNS,
      });
    },

    updateField(flightId, field, value) {
      return updateOneField({
        db,
        table: "flight_timings",
        whereColumn: "flight_id",
        whereValue: flightId,
        field,
        value,
        columnMap: TIMING_COLUMNS,
      });
    },
  };
}
