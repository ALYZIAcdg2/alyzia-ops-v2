import { assertD1Database } from "./repositoryUtils.js";

export function createIngestionRepository(db) {
  assertD1Database(db);

  return {
    createMessage(message) {
      return db
        .prepare(
          `INSERT INTO ingestion_messages (
             id, provider, provider_message_id, provider_thread_id,
             ingestion_status, received_at, created_by
           ) VALUES (?1, 'GMAIL', ?2, ?3, ?4, ?5, ?6)`,
        )
        .bind(
          message.id,
          message.provider_message_id,
          message.provider_thread_id ?? null,
          message.ingestion_status,
          message.received_at ?? null,
          message.created_by,
        )
        .run();
    },

    findByProviderMessageId(providerMessageId) {
      return db
        .prepare(
          `SELECT * FROM ingestion_messages
           WHERE provider = 'GMAIL' AND provider_message_id = ?1
           LIMIT 1`,
        )
        .bind(providerMessageId)
        .first();
    },

    findById(ingestionId) {
      return db
        .prepare("SELECT * FROM ingestion_messages WHERE id = ?1 LIMIT 1")
        .bind(ingestionId)
        .first();
    },

    async list({ limit = 25, offset = 0 } = {}) {
      const result = await db
        .prepare(
          `SELECT id, provider, import_id, ingestion_status, received_at,
                  processed_at, created_by, created_at
           FROM ingestion_messages
           ORDER BY created_at DESC, id DESC
           LIMIT ?1 OFFSET ?2`,
        )
        .bind(limit, offset)
        .all();
      return result.results ?? [];
    },

    updateStatus(
      ingestionId,
      ingestionStatus,
      { import_id, processed_at } = {},
    ) {
      return db
        .prepare(
          `UPDATE ingestion_messages
           SET ingestion_status = ?1,
               import_id = COALESCE(?2, import_id),
               processed_at = COALESCE(
                 ?3,
                 strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
               )
           WHERE id = ?4`,
        )
        .bind(
          ingestionStatus,
          import_id ?? null,
          processed_at ?? null,
          ingestionId,
        )
        .run();
    },

    addObject(ingestionId, object) {
      return db
        .prepare(
          `INSERT INTO ingestion_objects (
             ingestion_id, r2_key, object_role, source_name, media_type,
             size_bytes, sha256, object_status
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
        )
        .bind(
          ingestionId,
          object.r2_key,
          object.object_role,
          object.source_name ?? null,
          object.media_type ?? null,
          object.size_bytes,
          object.sha256,
          object.object_status,
        )
        .run();
    },

    async getObjects(ingestionId) {
      const result = await db
        .prepare(
          `SELECT id, ingestion_id, r2_key, object_role, source_name,
                  media_type, size_bytes, sha256, object_status, created_at
           FROM ingestion_objects WHERE ingestion_id = ?1 ORDER BY id`,
        )
        .bind(ingestionId)
        .all();
      return result.results ?? [];
    },
  };
}
