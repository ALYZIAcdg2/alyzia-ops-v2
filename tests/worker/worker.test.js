import test from "node:test";
import assert from "node:assert/strict";

import worker from "../../src/worker.js";
import { createLot2FlightFixture } from "../fixtures/lot2FlightFixture.js";
import { createSqEditingFixture } from "../fixtures/sqEditingFixture.js";
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

test("GET /api/health returns the Lot 5 service contract", async () => {
  const response = await worker.fetch(request("/api/health"), {});

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: "ALYZIA OPS",
    version: "0.6.0",
  });
});

test("SQ parser API previews a source without writing to D1", async () => {
  const database = createSQLiteD1();
  const env = { DB: database.db, API_WRITE_TOKEN: WRITE_TOKEN };
  try {
    const response = await worker.fetch(
      jsonPost("/api/sq/parse", {
        source_text: createSqEditingFixture(),
        options: { service_year: 2026 },
      }),
      env,
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.parse.can_import, true);
    assert.equal(body.parse.model.flight.flight_id, "SQ-335-20260819-CDG-SIN");

    const imports = await worker.fetch(request("/api/imports"), env);
    assert.deepEqual((await imports.json()).imports, []);
  } finally {
    database.close();
  }
});

test("SQ parser API refuses import when the date year is ambiguous", async () => {
  const database = createSQLiteD1();
  const env = { DB: database.db, API_WRITE_TOKEN: WRITE_TOKEN };
  try {
    const response = await worker.fetch(
      jsonPost("/api/sq/import", {
        source_text: createSqEditingFixture(),
        context: {
          import_id: "IMPORT-SQ-AMBIGUOUS",
          import_mode: "MANUAL",
          data_scope: "PARTIAL",
          user_id: "SQ_FIXTURE_USER",
        },
      }),
      env,
    );
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.equal(body.code, "SQ_REVIEW_REQUIRED");
    assert.ok(
      body.details.parse.issues.some(
        (issue) => issue.issue_code === "DATE_AMBIGUOUS",
      ),
    );
  } finally {
    database.close();
  }
});

test("SQ parser API imports a reviewed fixture and records parser metadata", async () => {
  const database = createSQLiteD1();
  const env = { DB: database.db, API_WRITE_TOKEN: WRITE_TOKEN };
  try {
    const response = await worker.fetch(
      jsonPost("/api/sq/import", {
        source_text: createSqEditingFixture(),
        source_name: "SQ FIXTURE EDITING",
        options: { service_year: 2026 },
        context: {
          import_id: "IMPORT-SQ-FIXTURE",
          import_mode: "MANUAL",
          data_scope: "PARTIAL",
          user_id: "SQ_FIXTURE_USER",
        },
      }),
      env,
    );
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.result.status, "PROCESSED");
    assert.equal(body.result.flight.flight.flight_id, "SQ-335-20260819-CDG-SIN");

    const detailResponse = await worker.fetch(
      request("/api/imports/IMPORT-SQ-FIXTURE"),
      env,
    );
    const detail = await detailResponse.json();
    assert.equal(detail.import.parser_name, "sq-editing");
    assert.equal(detail.sources[0].detected_type, "SQ_EDITING_TEXT");
    assert.ok(
      detail.issues.some(
        (issue) => issue.issue_code === "SQ_SOURCE_LINES_UNPARSED",
      ),
    );
  } finally {
    database.close();
  }
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

test("GET /api/imports/:id returns import, sources, issues and history", async () => {
  const importFixture = { id: "IMPORT-FIXTURE", import_status: "PENDING" };
  const { db } = createD1Mock({
    first: [importFixture],
    all: [
      { results: [{ id: 1 }] },
      { results: [{ id: 2 }] },
      { results: [{ id: 3 }] },
    ],
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
    history: [{ id: 3 }],
  });
});

test("import API creates, lists and exposes a structured import", async () => {
  const database = createSQLiteD1();
  const env = { DB: database.db, API_WRITE_TOKEN: WRITE_TOKEN };
  const model = createLot2FlightFixture();
  const payload = {
    model,
    context: {
      import_id: "IMPORT-API-LOT3",
      import_mode: "MANUAL",
      data_scope: "PARTIAL",
      user_id: "WORKER_TEST_USER",
    },
  };

  try {
    const createdResponse = await worker.fetch(
      jsonPost("/api/imports", payload),
      env,
    );
    assert.equal(createdResponse.status, 201);
    assert.match(
      createdResponse.headers.get("Location"),
      /\/api\/imports\/IMPORT-API-LOT3$/u,
    );
    const created = (await createdResponse.json()).result;
    assert.equal(created.status, "PROCESSED");
    assert.equal(created.flight.flight.flight_id, model.flight.flight_id);

    const listResponse = await worker.fetch(request("/api/imports"), env);
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json();
    assert.equal(list.imports.length, 1);
    assert.equal(list.imports[0].id, "IMPORT-API-LOT3");

    const detailResponse = await worker.fetch(
      request("/api/imports/IMPORT-API-LOT3"),
      env,
    );
    const detail = await detailResponse.json();
    assert.equal(detail.import.import_status, "PROCESSED");
    assert.equal(detail.sources.length, 1);
    assert.equal(detail.history.length, 1);
  } finally {
    database.close();
  }
});

test("import API requires write authorization and rejects duplicate ids", async () => {
  const database = createSQLiteD1();
  const env = { DB: database.db, API_WRITE_TOKEN: WRITE_TOKEN };
  const payload = {
    model: createLot2FlightFixture(),
    context: {
      import_id: "IMPORT-API-UNIQUE",
      import_mode: "MANUAL",
      data_scope: "PARTIAL",
      user_id: "WORKER_TEST_USER",
    },
  };

  try {
    const unauthorized = await worker.fetch(
      jsonPost("/api/imports", payload, "wrong-token"),
      env,
    );
    assert.equal(unauthorized.status, 401);

    assert.equal(
      (await worker.fetch(jsonPost("/api/imports", payload), env)).status,
      201,
    );
    const duplicate = await worker.fetch(
      jsonPost("/api/imports", payload),
      env,
    );
    assert.equal(duplicate.status, 409);
    const duplicateBody = await duplicate.json();
    assert.equal(duplicateBody.code, "IMPORT_ID_ALREADY_EXISTS");
    assert.equal(
      duplicateBody.details.result.issues[0].issue_code,
      "IMPORT_ID_ALREADY_EXISTS",
    );
  } finally {
    database.close();
  }
});

test("Import Center API filters, summarizes and records human issue decisions", async () => {
  const database = createSQLiteD1();
  const env = { DB: database.db, API_WRITE_TOKEN: WRITE_TOKEN };
  try {
    await database.db
      .prepare(
        `INSERT INTO imports (
          id, import_mode, import_status, data_scope, parser_name, created_by
        ) VALUES (?1, 'MANUAL', 'REVIEW_REQUIRED', 'PARTIAL', 'sq-editing', ?2)`,
      )
      .bind("IMPORT-CENTER-FIXTURE", "CENTER_TEST_USER")
      .run();
    await database.db
      .prepare(
        `INSERT INTO import_issues (
          import_id, severity, issue_code, message, resolution_status
        ) VALUES (?1, 'REVIEW', 'FIXTURE_REVIEW', 'Fixture review issue', 'OPEN')`,
      )
      .bind("IMPORT-CENTER-FIXTURE")
      .run();

    const filtered = await worker.fetch(
      request("/api/imports?status=REVIEW_REQUIRED&mode=MANUAL&q=CENTER"),
      env,
    );
    const filteredBody = await filtered.json();
    assert.equal(filteredBody.imports.length, 1);
    assert.equal(filteredBody.filters.status, "REVIEW_REQUIRED");
    assert.equal(filteredBody.pagination.has_previous, false);

    const summary = await worker.fetch(request("/api/imports/summary"), env);
    assert.deepEqual((await summary.json()).summary, {
      total: 1,
      pending: 0,
      processed: 0,
      no_change: 0,
      review_required: 1,
      error: 0,
      open_issues: 1,
    });

    const detailBefore = await worker.fetch(
      request("/api/imports/IMPORT-CENTER-FIXTURE"),
      env,
    );
    const issueId = (await detailBefore.json()).issues[0].id;
    const decided = await worker.fetch(
      jsonPost(
        `/api/imports/IMPORT-CENTER-FIXTURE/issues/${issueId}`,
        {
          resolution_status: "RESOLVED",
          resolved_by: "CENTER_REVIEWER",
        },
      ),
      env,
    );
    assert.equal(decided.status, 405);

    const patchResponse = await worker.fetch(
      request(`/api/imports/IMPORT-CENTER-FIXTURE/issues/${issueId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WRITE_TOKEN}`,
        },
        body: JSON.stringify({
          resolution_status: "RESOLVED",
          resolved_by: "CENTER_REVIEWER",
        }),
      }),
      env,
    );
    assert.equal(patchResponse.status, 200);
    const decision = await patchResponse.json();
    assert.equal(decision.issue.resolution_status, "RESOLVED");
    assert.equal(decision.issue.resolved_by, "CENTER_REVIEWER");

    const detailAfter = await worker.fetch(
      request("/api/imports/IMPORT-CENTER-FIXTURE"),
      env,
    );
    const after = await detailAfter.json();
    assert.equal(after.import.import_status, "REVIEW_REQUIRED");
  } finally {
    database.close();
  }
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
