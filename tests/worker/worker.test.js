import test from "node:test";
import assert from "node:assert/strict";

import worker from "../../src/worker.js";
import { createD1Mock } from "../repositories/d1Mock.js";

test("GET /api/health returns the required service contract", async () => {
  const response = await worker.fetch(
    new Request("https://fixture.invalid/api/health"),
    {},
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: "ALYZIA OPS",
    version: "0.1.0",
  });
});

test("GET /api/flights/:id uses flightRepository", async () => {
  const fixture = { id: "SQ-335-20260819-CDG-SIN", airline: "SQ" };
  const { db, calls } = createD1Mock({ first: [fixture] });
  const response = await worker.fetch(
    new Request("https://fixture.invalid/api/flights/SQ-335-20260819-CDG-SIN"),
    { DB: db },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { flight: fixture });
  assert.deepEqual(calls[0].values, ["SQ-335-20260819-CDG-SIN"]);
});

test("GET /api/imports/:id returns import, sources and issues", async () => {
  const importFixture = { id: "IMPORT-FIXTURE", import_status: "PENDING" };
  const { db } = createD1Mock({
    first: [importFixture],
    all: [{ results: [{ id: 1 }] }, { results: [{ id: 2 }] }],
  });
  const response = await worker.fetch(
    new Request("https://fixture.invalid/api/imports/IMPORT-FIXTURE"),
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
  const response = await worker.fetch(new Request("https://fixture.invalid/"), {
    ASSETS: {
      fetch() {
        return Promise.resolve(new Response("fixture asset"));
      },
    },
  });

  assert.equal(await response.text(), "fixture asset");
});
