import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createBrowserFixture } from "../../public/js/fixture.js";
import { renderFlightDetail } from "../../public/js/renderFlight.js";
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
  assert.match(html, /Fixture uniquement/u);
  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//iu);
  assert.doesNotMatch(app, /localStorage|sessionStorage/u);
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
