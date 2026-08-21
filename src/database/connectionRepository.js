import {
  assertD1Database,
  collectMappedFields,
  numberedPlaceholders,
  updateOneField,
} from "./repositoryUtils.js";

const INBOUND_COLUMNS = Object.freeze({
  inbound_flight: "inbound_flight",
  origin: "origin",
  destination: "destination",
  arrival_time: "arrival_time",
  connection_time: "connection_time",
  pax_count: "pax_count",
  remark: "remark",
});

const OUTBOUND_COLUMNS = Object.freeze({
  outbound_flight: "outbound_flight",
  origin: "origin",
  destination: "destination",
  std: "std",
  connection_time: "connection_time",
  total_pax: "total_pax",
  final_destination: "final_destination",
  terminal: "terminal",
  gate: "gate",
  remark: "remark",
});

function insertConnectionEntity(db, table, flightId, data, columnMap) {
  const entries = collectMappedFields(data, columnMap);
  const columns = ["flight_id", ...entries.map(({ column }) => column)];
  const values = [flightId, ...entries.map(({ value }) => value)];
  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${numberedPlaceholders(values.length).join(", ")})`;
  return db.prepare(sql).bind(...values).run();
}

export function createConnectionRepository(db) {
  assertD1Database(db);

  return {
    async getInboundsByFlightId(flightId) {
      const result = await db
        .prepare("SELECT * FROM flight_inbounds WHERE flight_id = ?1 ORDER BY id")
        .bind(flightId)
        .all();
      return result.results ?? [];
    },

    addInbound(flightId, inbound) {
      return insertConnectionEntity(
        db,
        "flight_inbounds",
        flightId,
        inbound,
        INBOUND_COLUMNS,
      );
    },

    updateInboundField(inboundId, field, value) {
      return updateOneField({
        db,
        table: "flight_inbounds",
        whereColumn: "id",
        whereValue: inboundId,
        field,
        value,
        columnMap: INBOUND_COLUMNS,
      });
    },

    removeInbound(inboundId) {
      return db
        .prepare("DELETE FROM flight_inbounds WHERE id = ?1")
        .bind(inboundId)
        .run();
    },

    async getOutboundsByFlightId(flightId) {
      const result = await db
        .prepare(
          "SELECT * FROM flight_outbound_connections WHERE flight_id = ?1 ORDER BY id",
        )
        .bind(flightId)
        .all();
      return result.results ?? [];
    },

    addOutbound(flightId, outbound) {
      return insertConnectionEntity(
        db,
        "flight_outbound_connections",
        flightId,
        outbound,
        OUTBOUND_COLUMNS,
      );
    },

    updateOutboundField(outboundId, field, value) {
      return updateOneField({
        db,
        table: "flight_outbound_connections",
        whereColumn: "id",
        whereValue: outboundId,
        field,
        value,
        columnMap: OUTBOUND_COLUMNS,
      });
    },

    removeOutbound(outboundId) {
      return db
        .prepare("DELETE FROM flight_outbound_connections WHERE id = ?1")
        .bind(outboundId)
        .run();
    },

    async getOutboundLoad(outboundConnectionId) {
      const result = await db
        .prepare(
          `SELECT * FROM flight_outbound_load
           WHERE outbound_connection_id = ?1
           ORDER BY id`,
        )
        .bind(outboundConnectionId)
        .all();
      return result.results ?? [];
    },

    async getOutboundLoadsByFlightId(flightId) {
      const result = await db
        .prepare(
          `SELECT outbound_load.*
           FROM flight_outbound_load AS outbound_load
           INNER JOIN flight_outbound_connections AS outbound
             ON outbound.id = outbound_load.outbound_connection_id
           WHERE outbound.flight_id = ?1
           ORDER BY outbound_load.id`,
        )
        .bind(flightId)
        .all();
      return result.results ?? [];
    },

    upsertOutboundLoad(outboundConnectionId, classCode, paxCount) {
      return db
        .prepare(
          `INSERT INTO flight_outbound_load
             (outbound_connection_id, class_code, pax_count)
           VALUES (?1, ?2, ?3)
           ON CONFLICT(outbound_connection_id, class_code) DO UPDATE SET
             pax_count = excluded.pax_count,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        )
        .bind(outboundConnectionId, classCode, paxCount)
        .run();
    },

    removeOutboundLoad(outboundConnectionId, classCode) {
      return db
        .prepare(
          `DELETE FROM flight_outbound_load
           WHERE outbound_connection_id = ?1 AND class_code = ?2`,
        )
        .bind(outboundConnectionId, classCode)
        .run();
    },

    async getPassengerConnections(passengerId) {
      const result = await db
        .prepare(
          `SELECT
             connection.*,
             inbound.inbound_flight,
             inbound.origin AS inbound_origin,
             inbound.destination AS inbound_destination,
             outbound.outbound_flight,
             outbound.origin AS outbound_origin,
             outbound.destination AS outbound_destination
           FROM passenger_connections AS connection
           LEFT JOIN flight_inbounds AS inbound ON inbound.id = connection.inbound_id
           LEFT JOIN flight_outbound_connections AS outbound ON outbound.id = connection.outbound_id
           WHERE connection.passenger_id = ?1
           ORDER BY connection.id`,
        )
        .bind(passengerId)
        .all();
      return result.results ?? [];
    },

    async getPassengerConnectionsByFlightId(flightId) {
      const result = await db
        .prepare(
          `SELECT connection.*
           FROM passenger_connections AS connection
           INNER JOIN flight_passengers AS passenger
             ON passenger.id = connection.passenger_id
           WHERE passenger.flight_id = ?1
           ORDER BY connection.id`,
        )
        .bind(flightId)
        .all();
      return result.results ?? [];
    },

    linkPassengerToInbound(passengerId, inboundId) {
      return db
        .prepare(
          `INSERT INTO passenger_connections
             (passenger_id, connection_type, inbound_id, outbound_id)
           VALUES (?1, 'INBOUND', ?2, NULL)
           ON CONFLICT DO NOTHING`,
        )
        .bind(passengerId, inboundId)
        .run();
    },

    linkPassengerToOutbound(passengerId, outboundId) {
      return db
        .prepare(
          `INSERT INTO passenger_connections
             (passenger_id, connection_type, inbound_id, outbound_id)
           VALUES (?1, 'OUTBOUND', NULL, ?2)
           ON CONFLICT DO NOTHING`,
        )
        .bind(passengerId, outboundId)
        .run();
    },

    unlinkPassengerConnection(connectionId) {
      return db
        .prepare("DELETE FROM passenger_connections WHERE id = ?1")
        .bind(connectionId)
        .run();
    },
  };
}
