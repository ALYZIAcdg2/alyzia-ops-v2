-- ALYZIA OPS V2 — D1 bootstrap
-- Idempotent foundational schema for a brand-new alyzia-ops-v2-db.
-- Keep operational payloads in data_json; typed columns exist only for indexing/routing.

CREATE TABLE IF NOT EXISTS flights (
  identity TEXT PRIMARY KEY,
  flight_date TEXT NOT NULL,
  airline TEXT NOT NULL,
  flight_number TEXT NOT NULL,
  std TEXT,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_flights_flight_date
  ON flights(flight_date);

CREATE INDEX IF NOT EXISTS idx_flights_updated_at
  ON flights(updated_at);

CREATE INDEX IF NOT EXISTS idx_flights_airline_date
  ON flights(airline, flight_date);

CREATE INDEX IF NOT EXISTS idx_flights_date_std
  ON flights(flight_date, std, flight_number);

CREATE TABLE IF NOT EXISTS ops_meta (
  k TEXT PRIMARY KEY,
  v TEXT
);

-- Cabin catalogue used by the existing automatic seat-map/config selection.
CREATE TABLE IF NOT EXISTS cabin_configs (
  config_key TEXT PRIMARY KEY,
  airline TEXT NOT NULL,
  aircraft TEXT NOT NULL,
  configuration TEXT,
  total INTEGER,
  classes_json TEXT NOT NULL DEFAULT '{}',
  quality TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cabin_configs_airline_aircraft
  ON cabin_configs(airline, aircraft);

-- Provider scheduler tables. Runtime code also uses CREATE TABLE IF NOT EXISTS,
-- but defining them here makes a fresh D1 deterministic from the first cron.
CREATE TABLE IF NOT EXISTS provider_enrichment_queue (
  flight_identity TEXT NOT NULL,
  flight_date TEXT NOT NULL,
  provider TEXT NOT NULL,
  fields_json TEXT NOT NULL,
  delta_minutes INTEGER,
  stop_all INTEGER NOT NULL DEFAULT 0,
  evaluated_at TEXT NOT NULL,
  PRIMARY KEY(flight_identity, provider)
);

CREATE INDEX IF NOT EXISTS idx_provider_queue_date_provider
  ON provider_enrichment_queue(flight_date, provider, stop_all);

CREATE TABLE IF NOT EXISTS provider_observability_snapshot (
  flight_date TEXT NOT NULL,
  provider TEXT NOT NULL,
  potential INTEGER NOT NULL DEFAULT 0,
  waiting INTEGER NOT NULL DEFAULT 0,
  avoided INTEGER NOT NULL DEFAULT 0,
  stop_all INTEGER NOT NULL DEFAULT 0,
  evaluated_at TEXT NOT NULL,
  PRIMARY KEY(flight_date, provider)
);

CREATE TABLE IF NOT EXISTS api_provider_usage (
  provider TEXT NOT NULL,
  period TEXT NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  successes INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  last_status INTEGER,
  last_at TEXT,
  PRIMARY KEY(provider, period)
);

INSERT INTO ops_meta(k, v)
VALUES('schema_version', 'v2-core-0001')
ON CONFLICT(k) DO UPDATE SET v = excluded.v;
