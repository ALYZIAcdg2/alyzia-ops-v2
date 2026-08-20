import {
  assertD1Database,
  updateMappedFields,
} from "./repositoryUtils.js";

const EMD_UPDATE_COLUMNS = Object.freeze({
  passenger_id: "passenger_id",
  emd_number: "emd_number",
  associated_code: "associated_code",
  remark: "remark",
});

export function createTicketDocumentRepository(db) {
  assertD1Database(db);

  return {
    async getTicketsByFlightId(flightId) {
      const result = await db
        .prepare("SELECT * FROM passenger_tickets WHERE flight_id = ?1 ORDER BY id")
        .bind(flightId)
        .all();
      return result.results ?? [];
    },

    async getEmdsByFlightId(flightId) {
      const result = await db
        .prepare("SELECT * FROM passenger_emds WHERE flight_id = ?1 ORDER BY id")
        .bind(flightId)
        .all();
      return result.results ?? [];
    },

    async getUnclassifiedByFlightId(flightId) {
      const result = await db
        .prepare(
          "SELECT * FROM passenger_unclassified_documents WHERE flight_id = ?1 ORDER BY id",
        )
        .bind(flightId)
        .all();
      return result.results ?? [];
    },

    addTicket(flightId, { passenger_id, etkt_number }) {
      return db
        .prepare(
          `INSERT INTO passenger_tickets (flight_id, passenger_id, etkt_number)
           VALUES (?1, ?2, ?3)`,
        )
        .bind(flightId, passenger_id, etkt_number)
        .run();
    },

    removeTicket(ticketId) {
      return db
        .prepare("DELETE FROM passenger_tickets WHERE id = ?1")
        .bind(ticketId)
        .run();
    },

    addEmd(
      flightId,
      { passenger_id, emd_number, associated_code, remark },
    ) {
      return db
        .prepare(
          `INSERT INTO passenger_emds
             (flight_id, passenger_id, emd_number, associated_code, remark)
           VALUES (?1, ?2, ?3, ?4, ?5)`,
        )
        .bind(
          flightId,
          passenger_id,
          emd_number,
          associated_code ?? null,
          remark ?? null,
        )
        .run();
    },

    updateEmdFields(emdId, fields) {
      return updateMappedFields({
        db,
        table: "passenger_emds",
        whereColumn: "id",
        whereValue: emdId,
        data: fields,
        columnMap: EMD_UPDATE_COLUMNS,
      });
    },

    removeEmd(emdId) {
      return db
        .prepare("DELETE FROM passenger_emds WHERE id = ?1")
        .bind(emdId)
        .run();
    },

    addUnclassifiedDocument(
      flightId,
      { passenger_id, document_value, document_hint },
    ) {
      return db
        .prepare(
          `INSERT INTO passenger_unclassified_documents
             (flight_id, passenger_id, document_value, document_hint)
           VALUES (?1, ?2, ?3, ?4)`,
        )
        .bind(
          flightId,
          passenger_id ?? null,
          document_value,
          document_hint ?? null,
        )
        .run();
    },

    removeUnclassifiedDocument(documentId) {
      return db
        .prepare("DELETE FROM passenger_unclassified_documents WHERE id = ?1")
        .bind(documentId)
        .run();
    },
  };
}
