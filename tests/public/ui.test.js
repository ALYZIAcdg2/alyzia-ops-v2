import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createBrowserFixture } from "../../public/js/fixture.js";
import { renderFlightDetail } from "../../public/js/renderFlight.js";
import {
  renderImportDetail,
  renderImportList,
} from "../../public/js/renderImport.js";
import { renderSqParse } from "../../public/js/renderSqParse.js";
import { normalizeFlightCreationInput } from "../../src/services/flightValidation.js";

const publicUrl = new URL("../../public/", import.meta.url);

function readPublicFile(name) {
  return readFileSync(new URL(name, publicUrl), "utf8");
}

test("static UI loads modular CSS and JavaScript without a frontend framework", () => {
  const html = readPublicFile("index.html");
  const app = readPublicFile("js/app.js");

  assert.match(html, /href="\/styles\.css"/u);
  assert.match(html, /type="module" src="\/js\/app\.js"/u);
  assert.match(html, /id="flight-list"/u);
  assert.match(html, /id="flight-detail"/u);
  assert.match(html, /id="import-list"/u);
  assert.match(html, /id="import-model"/u);
  assert.match(html, /id="sq-source"/u);
  assert.match(html, /id="preview-sq"/u);
  assert.match(html, /Choisir explicitement/u);
  assert.match(html, /Fixture uniquement/u);
  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//iu);
  assert.doesNotMatch(app, /localStorage|sessionStorage/u);
});

test("SQ preview escapes parser issues and exposes the import gate", () => {
  const container = { innerHTML: "" };
  renderSqParse(container, {
    can_import: false,
    parser: {
      name: "sq-editing",
      version: "0.1.0",
      detection_confidence: 0.8,
    },
    model: {
      flight: { flight_id: "SQ-<FIXTURE>" },
      passengers: [],
      particularities: [],
      tickets_documents: { etkt: [], emds: [], unclassified: [] },
    },
    diagnostics: { matched_line_count: 4, line_count: 5 },
    issues: [
      {
        severity: "REVIEW",
        issue_code: "FIXTURE_<ISSUE>",
        field_path: "flight.fixture",
        message: "<MESSAGE>",
      },
    ],
  });

  assert.match(container.innerHTML, /Révision requise/u);
  assert.match(container.innerHTML, /SQ-&lt;FIXTURE&gt;/u);
  assert.match(container.innerHTML, /FIXTURE_&lt;ISSUE&gt;/u);
  assert.match(container.innerHTML, /&lt;MESSAGE&gt;/u);
  assert.doesNotMatch(container.innerHTML, /<MESSAGE>/u);
});

test("import rendering escapes technical records and exposes Lot 3 status", () => {
  const listContainer = { innerHTML: "" };
  const detailContainer = { innerHTML: "" };
  renderImportList(listContainer, [
    {
      id: "IMPORT-<TEST>",
      import_status: "REVIEW_REQUIRED",
      flight_id: null,
      created_at: "2099-12-31T12:00:00.000Z",
    },
  ]);
  renderImportDetail(detailContainer, {
    import: {
      id: "IMPORT-<TEST>",
      import_status: "REVIEW_REQUIRED",
      flight_id: null,
      data_scope: "PARTIAL",
      import_mode: "MANUAL",
      created_by: "FIXTURE-USER",
      started_at: "2099-12-31T12:00:00.000Z",
      completed_at: null,
    },
    sources: [{ source_name: "<SOURCE>", source_type: "STRUCTURED_JSON", file_status: "RECOGNIZED" }],
    issues: [{ severity: "REVIEW", issue_code: "FIXTURE_ISSUE", field_path: "timings.std", message: "<MESSAGE>" }],
    history: [],
  });

  assert.match(listContainer.innerHTML, /Révision requise/u);
  assert.match(detailContainer.innerHTML, /&lt;SOURCE&gt;/u);
  assert.match(detailContainer.innerHTML, /&lt;MESSAGE&gt;/u);
  assert.doesNotMatch(detailContainer.innerHTML, /<SOURCE>|<MESSAGE>/u);
  assert.match(detailContainer.innerHTML, /value-unknown">Inconnu/u);
});

test("browser fixture is explicit, unique and accepted by Lot 2 validation", () => {
  const first = createBrowserFixture("2099-12-31");
  const second = createBrowserFixture("2099-12-31");
  const normalized = normalizeFlightCreationInput(first);

  assert.notEqual(first.flight.flight_id, second.flight.flight_id);
  assert.match(normalized.flight.flight_id, /^ZZ-T[A-Z0-9]+-20991231-TST-LAB$/u);
  assert.equal(normalized.flight.service_date_raw, "31DEC");
  assert.equal(normalized.passengers[0].passenger_name_raw, "FIXTURE/ADULT01");
  assert.equal(normalized.load.booked[1].value, 0);
  assert.equal(normalized.load.accepted[1].value, null);
  assert.equal(normalized.airline_extensions.constructor, Object);
});

test("flight rendering escapes data and distinguishes unknown from missing", () => {
  const model = normalizeFlightCreationInput(
    createBrowserFixture("2099-12-31"),
  );
  model.passengers[0].passenger_name_raw = "<FIXTURE-SCRIPT>";
  const container = { innerHTML: "" };

  renderFlightDetail(container, model);

  assert.match(container.innerHTML, /&lt;FIXTURE-SCRIPT&gt;/u);
  assert.doesNotMatch(container.innerHTML, /<FIXTURE-SCRIPT>/u);
  assert.match(container.innerHTML, /TEST_PREMIUM/u);
  assert.match(container.innerHTML, /value-unknown">Inconnu/u);
  assert.match(container.innerHTML, /value-absent">Non fourni/u);
  assert.match(container.innerHTML, />0<\/td>/u);
});
