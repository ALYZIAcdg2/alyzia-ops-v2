PRAGMA foreign_keys = ON;

CREATE TABLE ingestion_messages (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('GMAIL')),
  provider_message_id TEXT NOT NULL UNIQUE,
  provider_thread_id TEXT,
  import_id TEXT,
  ingestion_status TEXT NOT NULL CHECK (
    ingestion_status IN (
      'PENDING',
      'STORED',
      'PROCESSED',
      'NO_CHANGE',
      'REVIEW_REQUIRED',
      'ERROR'
    )
  ),
  received_at TEXT,
  processed_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (import_id) REFERENCES imports(id) ON DELETE SET NULL
);

CREATE TABLE ingestion_objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingestion_id TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  object_role TEXT NOT NULL CHECK (
    object_role IN ('RAW_MESSAGE', 'BODY_TEXT', 'ATTACHMENT')
  ),
  source_name TEXT,
  media_type TEXT,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  object_status TEXT NOT NULL CHECK (
    object_status IN ('STORED', 'PROCESSED', 'UNSUPPORTED', 'ERROR')
  ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (ingestion_id) REFERENCES ingestion_messages(id) ON DELETE CASCADE
);

CREATE INDEX idx_ingestion_messages_status_created
  ON ingestion_messages(ingestion_status, created_at);
CREATE INDEX idx_ingestion_messages_import ON ingestion_messages(import_id);
CREATE INDEX idx_ingestion_objects_ingestion ON ingestion_objects(ingestion_id);
