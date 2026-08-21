import test from "node:test";
import assert from "node:assert/strict";

import { ingestGmailMessage } from "../../src/services/gmailIngestionService.js";
import { createSqEditingFixture } from "../fixtures/sqEditingFixture.js";
import { createR2Mock } from "../repositories/r2Mock.js";
import { createSQLiteD1 } from "../repositories/sqliteD1.js";

function fixturePayload(overrides = {}) {
  return {
    provider_message_id: "FIXTURE-GMAIL-MESSAGE-001",
    provider_thread_id: "FIXTURE-GMAIL-THREAD-001",
    received_at: "2026-08-21T10:00:00.000Z",
    created_by: "GMAIL_FIXTURE_RELAY",
    text_content: "  FIXTURE SOURCE\nLINE TWO  ",
    attachments: [
      {
        filename: "FIXTURE-archive.zip",
        media_type: "application/zip",
        content_base64: btoa("FIXTURE ZIP CONTENT"),
      },
    ],
    ...overrides,
  };
}

test("Gmail ingestion archives exact content and metadata without importing by default", async () => {
  const database = createSQLiteD1();
  const r2 = createR2Mock();
  try {
    const result = await ingestGmailMessage({
      db: database.db,
      bucket: r2.bucket,
      payload: fixturePayload(),
    });
    assert.equal(result.status, "STORED");
    assert.equal(result.objects.length, 2);
    assert.equal(r2.objects.size, 2);
    assert.ok(
      result.objects.every(
        (object) =>
          !object.r2_key.includes("FIXTURE-GMAIL-MESSAGE-001") &&
          !object.r2_key.includes("FIXTURE-archive.zip"),
      ),
    );
    const body = [...r2.objects.values()].find(
      (object) => object.customMetadata.role === "BODY_TEXT",
    );
    assert.equal(new TextDecoder().decode(body.bytes), "  FIXTURE SOURCE\nLINE TWO  ");
    assert.equal(
      (
        await database.db
          .prepare("SELECT COUNT(*) AS count FROM imports")
          .first()
      ).count,
      0,
    );
  } finally {
    database.close();
  }
});

test("invalid base64 is rejected before an ingestion row is created", async () => {
  const database = createSQLiteD1();
  const r2 = createR2Mock();
  try {
    await assert.rejects(
      ingestGmailMessage({
        db: database.db,
        bucket: r2.bucket,
        payload: fixturePayload({
          attachments: [
            {
              filename: "FIXTURE-invalid.bin",
              content_base64: "not-base64!",
            },
          ],
        }),
      }),
      /base64 content is invalid/u,
    );
    assert.equal(
      (
        await database.db
          .prepare("SELECT COUNT(*) AS count FROM ingestion_messages")
          .first()
      ).count,
      0,
    );
    assert.equal(r2.objects.size, 0);
  } finally {
    database.close();
  }
});

test("provider message identity makes Gmail ingestion idempotent", async () => {
  const database = createSQLiteD1();
  const r2 = createR2Mock();
  try {
    const input = { db: database.db, bucket: r2.bucket, payload: fixturePayload() };
    await ingestGmailMessage(input);
    await assert.rejects(
      ingestGmailMessage(input),
      (error) =>
        error.status === 409 && error.code === "GMAIL_MESSAGE_ALREADY_INGESTED",
    );
  } finally {
    database.close();
  }
});

test("explicit SQ execution can connect an archived body to a structured import", async () => {
  const database = createSQLiteD1();
  const r2 = createR2Mock();
  try {
    const result = await ingestGmailMessage({
      db: database.db,
      bucket: r2.bucket,
      payload: fixturePayload({
        provider_message_id: "FIXTURE-GMAIL-MESSAGE-SQ",
        text_content: createSqEditingFixture(),
        attachments: [],
        sq_import: {
          execute: true,
          options: { service_year: 2026 },
          context: {
            import_id: "IMPORT-GMAIL-SQ-FIXTURE",
            import_mode: "AUTOMATIC",
            data_scope: "PARTIAL",
            user_id: "GMAIL_FIXTURE_RELAY",
          },
        },
      }),
    });
    assert.equal(result.status, "PROCESSED");
    assert.equal(result.result.import_id, "IMPORT-GMAIL-SQ-FIXTURE");
    const row = await database.db
      .prepare("SELECT import_id FROM ingestion_messages WHERE id = ?1")
      .bind(result.ingestion_id)
      .first();
    assert.equal(row.import_id, "IMPORT-GMAIL-SQ-FIXTURE");
  } finally {
    database.close();
  }
});
