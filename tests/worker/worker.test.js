import test from "node:test";
import assert from "node:assert/strict";

import worker from "../../src/worker.js";
import { createLot2FlightFixture } from "../fixtures/lot2FlightFixture.js";
import { createD1Mock } from "../repositories/d1Mock.js";
import { createSQLiteD1 } from "../repositories/sqliteD1.js";

const WRITE_TOKEN = "fixture-write-token-for-tests-only";

function request(path, options = {}) {
  return new Request(`https://fixture.invalid${path}`, options);
}

function jsonPost(path, body, token = WRITE_TOKEN) {
  return request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

test("GET /api/health returns the Lot 2 service contract", async () => {
  const response = await worker.fetch(request("/api/health"), {});

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: "ALYZIA OPS",
    version: "0.2.0",
  });
});

test("flight API creates, searches and returns a complete D1 aggregate", async () => {
  const database = createSQLiteD1();
  const env = { DB: database.db, API_WRITE_TOKEN: WRITE_TOKEN };
  const fixture = createLot2FlightFixture();

  try {
    const createResponse = await worker.fetch(
      jsonPost("/api/flights", fixture),
      env,
    );
    assert.equal(createResponse.status, 201);
    assert.match(
      createResponse.headers.get("Location"),
      /\/api\/flights\/ZZ-TEST21-20991231-TST-LAB$/u,
    );

    const created = (await createResponse.json()).flight;
    assert.equal(created.flight.flight_id, fixture.flight.flight_id);
    assert.equal(created.passengers.length, 2);
    assert.equal(created.passengers[1].passenger_type, "INF");
    assert.equal(
      created.passengers[1].parent_passenger_id,
      created.passengers[0].id,
    );
    assert.equal(created.flight.service_date_raw, "31DEC");
    assert.equal(created.timings.flight_status, "SCHEDULED");
    assert.equal(created.load.booked[0].value, 5);
    assert.equal(created.load.booked[1].value, 0);
    assert.equal(created.load.accepted[1].value, null);
    assert.equal(Object.hasOwn(created.load, "availability"), false);
    assert.equal(created.outbound_connections[0].total_pax, 3);
    assert.equal(created.outbound_connections[0].identified_pax_count, 2);
    assert.equal(created.tickets_documents.unclassified.length, 1);

    const searchResponse = await worker.fetch(
      request("/api/flights?q=ZZ-TEST21-20991231-TST-LAB"),
      env,
    );
    const search = await searchResponse.json();
    assert.equal(search.flights.length, 1);
    assert.equal(search.flights[0].flight_id, fixture.flight.flight_id);
    assert.equal(search.pagination.has_more, false);

    const detailResponse = await worker.fetch(
      request(`/api/flights/${fixture.flight.flight_id}`),
      env,
    );
    assert.equal(detailResponse.status, 200);
    const detail = (await detailResponse.json()).flight;
    assert.equal(detail.aircraft.cabin_configuration.length, 2);
    assert.equal(detail.particularities[1].codes[0].code, "FIXTURE_UNKNOWN_SSR");
    assert.equal(detail.inbound[0].pax_count, 2);
    assert.equal(detail.groups.summary.total_group_pax, 2);
    assert.equal(detail.class_comments.length, 1);

    const duplicateResponse = await worker.fetch(
      jsonPost("/api/flights", fixture),
      env,
    );
    assert.equal(duplicateResponse.status, 409);
    assert.equal((await duplicateResponse.json()).code, "FLIGHT_CONFLICT");
  } finally {
    database.close();
  }
});

test("flight writes require the configured secret", async () => {
  const database = createSQLiteD1();
  const fixture = createLot2FlightFixture();

  try {
    const unconfigured = await worker.fetch(
      jsonPost("/api/flights", fixture),
      { DB: database.db },
    );
    assert.equal(unconfigured.status, 503);

    const unauthorized = await worker.fetch(
      jsonPost("/api/flights", fixture, "wrong-token"),
      { DB: database.db, API_WRITE_TOKEN: WRITE_TOKEN },
    );
    assert.equal(unauthorized.status, 401);
    assert.equal(
      (await unauthorized.json()).code,
      "WRITE_AUTHORIZATION_REQUIRED",
    );
  } finally {
    database.close();
  }
});

test("failed aggregate creation removes the partial parent flight", async () => {
  const database = createSQLiteD1();
  const env = { DB: database.db, API_WRITE_TOKEN: WRITE_TOKEN };
  const fixture = createLot2FlightFixture();
  fixture.tickets_documents.etkt.push({
    ...fixture.tickets_documents.etkt[0],
    passenger_id: "PAX-INF-1",
  });

  try {
    const failed = await worker.fetch(
      jsonPost("/api/flights", fixture),
      env,
    );
    assert.equal(failed.status, 409);

    const list = await worker.fetch(request("/api/flights"), env);
    assert.deepEqual((await list.json()).flights, []);
  } finally {
    database.close();
  }
});

test("flight API validates pagination, payloads and unknown identifiers", async () => {
  const database = createSQLiteD1();
  const env = { DB: database.db, API_WRITE_TOKEN: WRITE_TOKEN };

  try {
    const invalidPagination = await worker.fetch(
      request("/api/flights?limit=0"),
      env,
    );
    assert.equal(invalidPagination.status, 400);

    const invalidPayload = await worker.fetch(
      jsonPost("/api/flights", { flight: {} }),
      env,
    );
    assert.equal(invalidPayload.status, 400);
    assert.equal((await invalidPayload.json()).code, "VALIDATION_ERROR");

    const unsupportedNestedField = createLot2FlightFixture();
    unsupportedNestedField.load.booked[0].calculated = true;
    const unsupported = await worker.fetch(
      jsonPost("/api/flights", unsupportedNestedField),
      env,
    );
    assert.equal(unsupported.status, 400);
    assert.equal((await unsupported.json()).code, "VALIDATION_ERROR");

    const missing = await worker.fetch(
      request("/api/flights/ZZ-MISSING-20991231-TST-LAB"),
      env,
    );
    assert.equal(missing.status, 404);
  } finally {
    database.close();
  }
});

test("GET /api/imports/:id returns import, sources and issues", async () => {
  const importFixture = { id: "IMPORT-FIXTURE", import_status: "PENDING" };
  const { db } = createD1Mock({
    first: [importFixture],
    all: [{ results: [{ id: 1 }] }, { results: [{ id: 2 }] }],
  });
  const response = await worker.fetch(
    request("/api/imports/IMPORT-FIXTURE"),
    { DB: db },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    import: importFixture,
    sources: [{ id: 1 }],
    issues: [{ id: 2 }],
  });
});

test("root requests are delegated to the static assets binding", async () => {
  const response = await worker.fetch(request("/"), {
    ASSETS: {
      fetch() {
        return Promise.resolve(new Response("fixture asset"));
      },
    },
  });

  assert.equal(await response.text(), "fixture asset");
  assert.match(
    response.headers.get("Content-Security-Policy"),
    /default-src 'self'/u,
  );
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
});
