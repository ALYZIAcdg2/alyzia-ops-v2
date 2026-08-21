import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createBrowserFixture } from "../../public/js/fixture.js";
import { renderFlightDetail } from "../../public/js/renderFlight.js";
import {
  renderImportDetail,
  renderImportList,
  renderImportSummary,
} from "../../public/js/renderImport.js";
import { renderSqParse } from "../../public/js/renderSqParse.js";
import {
  renderIngestionDetail,
  renderIngestionList,
} from "../../public/js/renderIngestion.js";
import { renderOpsSummary } from "../../public/js/renderOps.js";
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
  assert.match(html, /id="ingestion-list"/u);
  assert.match(html, /id="ingestion-source"/u);
  assert.match(html, /Archivage uniquement/u);
  assert.match(html, /id="ops-summary"/u);
  assert.match(html, /SUPERVISION ET EXTENSIONS/u);
  assert.match(html, /Choisir explicitement/u);
  assert.match(html, /Fixture uniquement/u);
  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//iu);
  assert.doesNotMatch(app, /localStorage|sessionStorage/u);
});

test("operational supervision renders metrics, bindings and extensions", () => {
  const container = { innerHTML: "" };
  renderOpsSummary(container, {
    status: "OPERATIONAL",
    generated_at: "2099-12-31T12:00:00.000Z",
    bindings: { d1: true, r2: true, queues: false },
    summary: {
      flights: 2,
      imports: 3,
      imports_review: 1,
      open_issues: 4,
      active_overrides: 0,
      ingestions: 5,
      archived_objects: 6,
      ingestions_error: 0,
    },
    extensions: [
      {
        id: "fixture-<extension>",
        extension_type: "PARSER",
        status: "ACTIVE",
        version: "0.1.0",
      },
    ],
  });
  assert.match(container.innerHTML, /OPERATIONAL/u);
  assert.match(container.innerHTML, /Objets R2/u);
  assert.match(container.innerHTML, /Non configuré/u);
  assert.match(container.innerHTML, /fixture-&lt;extension&gt;/u);
});

test("ingestion rendering escapes R2 metadata and shows archive status", () => {
  const listContainer = { innerHTML: "" };
  const detailContainer = { innerHTML: "" };
  renderIngestionList(listContainer, [
    {
      id: "GMAIL-<FIXTURE>",
      provider: "GMAIL",
      ingestion_status: "STORED",
      created_at: "2099-12-31T12:00:00.000Z",
    },
  ]);
  renderIngestionDetail(detailContainer, {
    ingestion: {
      id: "GMAIL-<FIXTURE>",
      provider: "GMAIL",
      import_id: null,
      ingestion_status: "STORED",
      received_at: null,
      processed_at: null,
      created_by: "FIXTURE-RELAY",
      created_at: "2099-12-31T12:00:00.000Z",
    },
    objects: [
      {
        object_role: "BODY_TEXT",
        source_name: "<FIXTURE-SOURCE>",
        media_type: "text/plain",
        size_bytes: 7,
        r2_key: "gmail/fixture/<object>",
      },
    ],
  });

  assert.match(listContainer.innerHTML, /Archivé/u);
  assert.match(detailContainer.innerHTML, /&lt;FIXTURE-SOURCE&gt;/u);
  assert.match(detailContainer.innerHTML, /&lt;object&gt;/u);
  assert.doesNotMatch(detailContainer.innerHTML, /<FIXTURE-SOURCE>|<object>/u);
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
    issues: [{ id: 7, severity: "REVIEW", issue_code: "FIXTURE_ISSUE", field_path: "timings.std", message: "<MESSAGE>", resolution_status: "OPEN" }],
    history: [],
  });

  assert.match(listContainer.innerHTML, /Révision requise/u);
  assert.match(detailContainer.innerHTML, /&lt;SOURCE&gt;/u);
  assert.match(detailContainer.innerHTML, /&lt;MESSAGE&gt;/u);
  assert.doesNotMatch(detailContainer.innerHTML, /<SOURCE>|<MESSAGE>/u);
  assert.match(detailContainer.innerHTML, /value-unknown">Inconnu/u);
  assert.match(detailContainer.innerHTML, /data-issue-id="7"/u);
  assert.match(detailContainer.innerHTML, /data-resolution="RESOLVED"/u);
});

test("Import Center summary renders numeric counters", () => {
  const container = { innerHTML: "" };
  renderImportSummary(container, {
    total: 12,
    review_required: 3,
    open_issues: 4,
    error: 1,
  });
  assert.match(container.innerHTML, /À réviser/u);
  assert.match(container.innerHTML, /<dd>4<\/dd>/u);
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
