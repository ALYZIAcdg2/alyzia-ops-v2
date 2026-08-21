import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const migrationsUrl = new URL("../../migrations/", import.meta.url);
const migrations = readdirSync(migrationsUrl)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(new URL(name, migrationsUrl), "utf8"));

function createSchema() {
  const db = new DatabaseSync(":memory:");
  for (const migration of migrations) db.exec(migration);
  return db;
}

function insertFixtureFlight(db) {
  db.prepare(
    `INSERT INTO flights
       (id, airline, flight_number, service_date_raw, service_date_internal,
        origin, destination, movement_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "ZZ-TEST1-20991231-TST-LAB",
    "ZZ",
    "TEST1",
    "31DEC",
    "2099-12-31",
    "TST",
    "LAB",
    "DEPARTURE",
  );
}

test("initial migration creates every required table", () => {
  const db = createSchema();
  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
    )
    .all()
    .map(({ name }) => name);

  assert.equal(tables.length, 26);
  assert.ok(tables.includes("flights"));
  assert.ok(tables.includes("passenger_unclassified_documents"));
  assert.ok(tables.includes("manual_changes"));
  assert.ok(tables.includes("ingestion_messages"));
  assert.ok(tables.includes("ingestion_objects"));
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  db.close();
});

test("inbound logical duplicates are not blocked by an over-strict UNIQUE", () => {
  const db = createSchema();
  insertFixtureFlight(db);
  const insert = db.prepare(
    `INSERT INTO flight_inbounds
       (flight_id, inbound_flight, origin, destination, arrival_time)
     VALUES (?, ?, ?, ?, ?)`,
  );

  insert.run("ZZ-TEST1-20991231-TST-LAB", "FIX100", "AAA", "TST", "10:00");
  insert.run("ZZ-TEST1-20991231-TST-LAB", "FIX100", "AAA", "TST", "10:10");

  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM flight_inbounds").get().count,
    2,
  );
  db.close();
});

test("passenger connection checks and partial unique indexes are enforced", () => {
  const db = createSchema();
  insertFixtureFlight(db);
  const passengerId = db
    .prepare(
      `INSERT INTO flight_passengers
         (flight_id, passenger_name_raw, passenger_type)
       VALUES (?, ?, ?)`,
    )
    .run("ZZ-TEST1-20991231-TST-LAB", "TEST/TRAVELER", "ADT")
    .lastInsertRowid;
  const inboundId = db
    .prepare(
      `INSERT INTO flight_inbounds
         (flight_id, inbound_flight, origin, destination)
       VALUES (?, ?, ?, ?)`,
    )
    .run("ZZ-TEST1-20991231-TST-LAB", "FIX100", "AAA", "TST")
    .lastInsertRowid;

  const link = db.prepare(
    `INSERT INTO passenger_connections
       (passenger_id, connection_type, inbound_id, outbound_id)
     VALUES (?, 'INBOUND', ?, NULL)`,
  );
  link.run(passengerId, inboundId);

  assert.throws(() => link.run(passengerId, inboundId), /UNIQUE constraint failed/u);
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO passenger_connections
             (passenger_id, connection_type, inbound_id, outbound_id)
           VALUES (?, 'OUTBOUND', ?, NULL)`,
        )
        .run(passengerId, inboundId),
    /CHECK constraint failed/u,
  );
  db.close();
});

test("flight deletion cascades to structured child records", () => {
  const db = createSchema();
  insertFixtureFlight(db);
  db.prepare(
    `INSERT INTO flight_load (flight_id, load_type, class_code, value)
     VALUES (?, 'BOOKED', 'FIXTURE', 0)`,
  ).run("ZZ-TEST1-20991231-TST-LAB");

  db.prepare("DELETE FROM flights WHERE id = ?").run(
    "ZZ-TEST1-20991231-TST-LAB",
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM flight_load").get().count, 0);
  db.close();
});
