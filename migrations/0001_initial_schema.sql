PRAGMA foreign_keys = ON;

CREATE TABLE flights (
  id TEXT PRIMARY KEY,
  airline TEXT NOT NULL,
  flight_number TEXT NOT NULL,
  service_date_raw TEXT,
  service_date_internal TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('DEPARTURE', 'ARRIVAL')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (airline, flight_number, service_date_internal, origin, destination)
);

CREATE TABLE flight_timings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL UNIQUE,
  std TEXT,
  etd TEXT,
  atd TEXT,
  boarding_time TEXT,
  flight_status TEXT CHECK (
    flight_status IS NULL OR
    flight_status IN ('SCHEDULED', 'DELAYED', 'DEPARTED', 'CANCELLED')
  ),
  acceptance_status TEXT CHECK (
    acceptance_status IS NULL OR
    acceptance_status IN ('NOT_OPEN', 'OPEN', 'CLOSED', 'UNKNOWN')
  ),
  status_validated_at TEXT,
  status_validated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
);

CREATE TABLE flight_aircraft (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL UNIQUE,
  aircraft_type TEXT,
  seatmap_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
);

CREATE TABLE flight_cabin_configuration (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL,
  class_code TEXT NOT NULL,
  capacity INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (flight_id, class_code),
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
);

CREATE TABLE flight_load (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL,
  load_type TEXT NOT NULL CHECK (
    load_type IN ('BOOKED', 'ACCEPTED', 'AVAILABILITY', 'STANDBY')
  ),
  class_code TEXT NOT NULL,
  value INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (flight_id, load_type, class_code),
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
);

CREATE TABLE flight_load_totals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL,
  metric TEXT NOT NULL CHECK (metric IN ('BOOKED_INFANTS', 'ACCEPTED_INFANTS')),
  value INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (flight_id, metric),
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
);

CREATE TABLE flight_passengers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL,
  passenger_name_raw TEXT,
  passenger_name_normalized TEXT,
  passenger_type TEXT NOT NULL CHECK (passenger_type IN ('ADT', 'CHLD', 'INF')),
  parent_passenger_id INTEGER,
  cabin_class TEXT,
  booking_class TEXT,
  seat TEXT,
  remark TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_passenger_id) REFERENCES flight_passengers(id) ON DELETE SET NULL
);

CREATE TABLE passenger_particularities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passenger_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (passenger_id, category, code),
  FOREIGN KEY (passenger_id) REFERENCES flight_passengers(id) ON DELETE CASCADE
);

CREATE TABLE flight_particularity_counts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL,
  category TEXT NOT NULL,
  code TEXT NOT NULL,
  pax_count INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (flight_id, category, code),
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
);

CREATE TABLE passenger_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL,
  passenger_id INTEGER NOT NULL,
  etkt_number TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (flight_id, etkt_number),
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE,
  FOREIGN KEY (passenger_id) REFERENCES flight_passengers(id) ON DELETE CASCADE
);

CREATE TABLE passenger_emds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL,
  passenger_id INTEGER NOT NULL,
  emd_number TEXT NOT NULL,
  associated_code TEXT,
  remark TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (flight_id, emd_number),
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE,
  FOREIGN KEY (passenger_id) REFERENCES flight_passengers(id) ON DELETE CASCADE
);

CREATE TABLE passenger_unclassified_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL,
  passenger_id INTEGER,
  document_value TEXT NOT NULL,
  document_hint TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE,
  FOREIGN KEY (passenger_id) REFERENCES flight_passengers(id) ON DELETE SET NULL
);

CREATE TABLE flight_inbounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL,
  inbound_flight TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  arrival_time TEXT,
  connection_time TEXT,
  pax_count INTEGER,
  remark TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
);

CREATE TABLE flight_outbound_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL,
  outbound_flight TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  std TEXT,
  connection_time TEXT,
  total_pax INTEGER,
  final_destination TEXT,
  terminal TEXT,
  gate TEXT,
  remark TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
);

CREATE TABLE flight_outbound_load (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outbound_connection_id INTEGER NOT NULL,
  class_code TEXT NOT NULL,
  pax_count INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (outbound_connection_id, class_code),
  FOREIGN KEY (outbound_connection_id) REFERENCES flight_outbound_connections(id) ON DELETE CASCADE
);

CREATE TABLE passenger_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passenger_id INTEGER NOT NULL,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('INBOUND', 'OUTBOUND')),
  inbound_id INTEGER,
  outbound_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (
    (connection_type = 'INBOUND' AND inbound_id IS NOT NULL AND outbound_id IS NULL) OR
    (connection_type = 'OUTBOUND' AND inbound_id IS NULL AND outbound_id IS NOT NULL)
  ),
  FOREIGN KEY (passenger_id) REFERENCES flight_passengers(id) ON DELETE CASCADE,
  FOREIGN KEY (inbound_id) REFERENCES flight_inbounds(id) ON DELETE CASCADE,
  FOREIGN KEY (outbound_id) REFERENCES flight_outbound_connections(id) ON DELETE CASCADE
);

CREATE TABLE flight_group_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL UNIQUE,
  group_count INTEGER,
  total_group_pax INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
);

CREATE TABLE flight_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL,
  group_name TEXT,
  pax_count INTEGER,
  cabin_class TEXT,
  pnr TEXT,
  remark TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
);

CREATE TABLE flight_class_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL,
  class_code TEXT NOT NULL,
  comment_text TEXT NOT NULL CHECK (length(trim(comment_text)) > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
);

CREATE TABLE imports (
  id TEXT PRIMARY KEY,
  flight_id TEXT,
  import_mode TEXT NOT NULL CHECK (import_mode IN ('MANUAL', 'AUTOMATIC')),
  import_status TEXT NOT NULL CHECK (
    import_status IN ('PENDING', 'PROCESSED', 'NO_CHANGE', 'REVIEW_REQUIRED', 'ERROR')
  ),
  data_scope TEXT CHECK (data_scope IS NULL OR data_scope IN ('FULL', 'PARTIAL')),
  parser_name TEXT,
  parser_version TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE SET NULL
);

CREATE TABLE import_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id TEXT NOT NULL,
  source_type TEXT,
  source_name TEXT,
  source_document TEXT,
  detected_type TEXT,
  detection_confidence REAL,
  source_timestamp TEXT,
  file_status TEXT NOT NULL CHECK (
    file_status IN ('RECOGNIZED', 'UNKNOWN', 'UNSUPPORTED', 'MISMATCH', 'ERROR')
  ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (import_id) REFERENCES imports(id) ON DELETE CASCADE
);

CREATE TABLE import_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'REVIEW', 'BLOCKING')),
  issue_code TEXT NOT NULL,
  field_path TEXT,
  current_value TEXT,
  incoming_value TEXT,
  message TEXT,
  resolution_status TEXT NOT NULL CHECK (resolution_status IN ('OPEN', 'RESOLVED', 'IGNORED')),
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (import_id) REFERENCES imports(id) ON DELETE CASCADE
);

CREATE TABLE field_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL,
  import_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  field_path TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_source TEXT NOT NULL CHECK (change_source IN ('IMPORT', 'MANUAL')),
  change_action TEXT NOT NULL CHECK (change_action IN ('CREATE', 'UPDATE', 'ADD', 'REMOVE')),
  changed_by TEXT,
  changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE,
  FOREIGN KEY (import_id) REFERENCES imports(id) ON DELETE SET NULL
);

CREATE TABLE manual_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  field_path TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  override_type TEXT NOT NULL CHECK (override_type IN ('TEMPORARY', 'LOCKED')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  changed_by TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deactivated_at TEXT,
  deactivated_by TEXT,
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
);

CREATE INDEX idx_flights_service_date ON flights(service_date_internal);
CREATE INDEX idx_flights_airline_number ON flights(airline, flight_number);

CREATE INDEX idx_cabin_configuration_flight ON flight_cabin_configuration(flight_id);
CREATE INDEX idx_flight_load_flight ON flight_load(flight_id);
CREATE INDEX idx_flight_load_totals_flight ON flight_load_totals(flight_id);

CREATE INDEX idx_passengers_flight ON flight_passengers(flight_id);
CREATE INDEX idx_passengers_name ON flight_passengers(flight_id, passenger_name_normalized);
CREATE INDEX idx_passengers_name_seat ON flight_passengers(
  flight_id,
  passenger_name_normalized,
  seat
);
CREATE INDEX idx_passengers_parent ON flight_passengers(parent_passenger_id);

CREATE INDEX idx_passenger_particularities_passenger ON passenger_particularities(passenger_id);
CREATE INDEX idx_particularity_counts_flight ON flight_particularity_counts(flight_id);

CREATE INDEX idx_tickets_flight ON passenger_tickets(flight_id);
CREATE INDEX idx_tickets_passenger ON passenger_tickets(passenger_id);
CREATE INDEX idx_emds_flight ON passenger_emds(flight_id);
CREATE INDEX idx_emds_passenger ON passenger_emds(passenger_id);
CREATE INDEX idx_unclassified_documents_flight ON passenger_unclassified_documents(flight_id);
CREATE INDEX idx_unclassified_documents_passenger ON passenger_unclassified_documents(passenger_id);

CREATE INDEX idx_inbounds_flight ON flight_inbounds(flight_id);
CREATE INDEX idx_inbounds_logical_key ON flight_inbounds(
  flight_id,
  inbound_flight,
  origin,
  destination
);
CREATE INDEX idx_outbounds_flight ON flight_outbound_connections(flight_id);
CREATE INDEX idx_outbounds_logical_key ON flight_outbound_connections(
  flight_id,
  outbound_flight,
  origin,
  destination,
  std,
  final_destination
);
CREATE INDEX idx_outbound_load_connection ON flight_outbound_load(outbound_connection_id);

CREATE INDEX idx_passenger_connections_passenger ON passenger_connections(passenger_id);
CREATE INDEX idx_passenger_connections_inbound ON passenger_connections(inbound_id);
CREATE INDEX idx_passenger_connections_outbound ON passenger_connections(outbound_id);
CREATE UNIQUE INDEX uq_passenger_inbound_connection
  ON passenger_connections(passenger_id, inbound_id)
  WHERE connection_type = 'INBOUND';
CREATE UNIQUE INDEX uq_passenger_outbound_connection
  ON passenger_connections(passenger_id, outbound_id)
  WHERE connection_type = 'OUTBOUND';

CREATE INDEX idx_groups_flight ON flight_groups(flight_id);
CREATE INDEX idx_groups_pnr ON flight_groups(flight_id, pnr);
CREATE INDEX idx_class_comments_flight ON flight_class_comments(flight_id);

CREATE INDEX idx_imports_flight ON imports(flight_id);
CREATE INDEX idx_imports_status_created ON imports(import_status, created_at);
CREATE INDEX idx_import_sources_import ON import_sources(import_id);
CREATE INDEX idx_import_issues_import_status ON import_issues(import_id, resolution_status);

CREATE INDEX idx_field_history_flight_changed ON field_history(flight_id, changed_at);
CREATE INDEX idx_field_history_import ON field_history(import_id);
CREATE INDEX idx_manual_changes_flight_active ON manual_changes(flight_id, active);
