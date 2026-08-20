import test from "node:test";
import assert from "node:assert/strict";

import { createAircraftModel } from "../../src/models/aircraftModel.js";
import { createInboundModel } from "../../src/models/connectionModel.js";
import { createFlightModel } from "../../src/models/flightModel.js";
import {
  FlightImportModel,
  createFlightImportModel,
} from "../../src/models/flightImportModel.js";
import { createGroupModel } from "../../src/models/groupModel.js";
import { createImportModel } from "../../src/models/importModel.js";
import { createLoadModel } from "../../src/models/loadModel.js";
import { createParticularityModel } from "../../src/models/particularityModel.js";
import { createPassengerModel } from "../../src/models/passengerModel.js";
import { createTicketDocumentModel } from "../../src/models/ticketDocumentModel.js";
import { createTimingModel } from "../../src/models/timingModel.js";

const FIXTURE_FLIGHT = Object.freeze({
  airline: "SQ",
  flight_number: "335",
  service_date_raw: "19AUG",
  service_date_internal: "2026-08-19",
  origin: "CDG",
  destination: "SIN",
  movement_type: "DEPARTURE",
  flight_id: "SQ-335-20260819-CDG-SIN",
});

test("individual model factories create isolated model values", () => {
  assert.deepEqual(createFlightModel(FIXTURE_FLIGHT), FIXTURE_FLIGHT);
  assert.deepEqual(createTimingModel({ std: "12:00" }), { std: "12:00" });
  assert.deepEqual(
    createAircraftModel({
      type: "FIXTURE-AIRCRAFT",
      cabin_configuration: [{ class: "W", capacity: 12 }],
    }),
    {
      type: "FIXTURE-AIRCRAFT",
      cabin_configuration: [{ class: "W", capacity: 12 }],
    },
  );
  assert.deepEqual(createLoadModel({ booked: [{ class: "W", value: 0 }] }), {
    booked: [{ class: "W", value: 0 }],
  });
  assert.equal(createPassengerModel({ passenger_type: "INF" }).passenger_type, "INF");
  assert.equal(createParticularityModel({ category: "OTHER" }).codes.length, 0);
  assert.equal(createTicketDocumentModel().unclassified.length, 0);
  assert.equal(createInboundModel().passenger_ids.length, 0);
  assert.equal(createGroupModel().items.length, 0);
  assert.deepEqual(createImportModel({ import_status: "PENDING" }), {
    import_status: "PENDING",
  });
});

test("FlightImportModel keeps the common structure airline-neutral", () => {
  const model = createFlightImportModel({
    flight: FIXTURE_FLIGHT,
    timings: {
      std: "12:00",
      etd: "12:20",
      atd: "12:25",
    },
    aircraft: {
      type: "FIXTURE-AIRCRAFT",
      cabin_configuration: [
        { class: "W", capacity: 12 },
        { class: "Y", capacity: 24 },
      ],
    },
    load: {
      booked: [
        { class: "W", value: 0 },
        { class: "Y", value: null },
      ],
    },
    passengers: [
      {
        temp_id: "FIXTURE-ADT",
        passenger_name_raw: "TEST/ADULT",
        passenger_type: "ADT",
      },
      {
        temp_id: "FIXTURE-INF",
        passenger_name_raw: "TEST/INFANT",
        passenger_type: "INF",
        parent_ref: "FIXTURE-ADT",
      },
    ],
    class_comments: [{ class: "W", comment: "Fixture comment" }],
  });

  assert.ok(model instanceof FlightImportModel);
  assert.equal(model.passengers.length, 2);
  assert.equal(model.passengers[1].parent_ref, "FIXTURE-ADT");
  assert.equal(model.aircraft.cabin_configuration[0].class, "W");
  assert.equal(model.load.booked[0].value, 0);
  assert.equal(model.load.booked[1].value, null);
  assert.equal(Object.hasOwn(model.load, "standby"), false);
  assert.equal(Object.hasOwn(model.timings, "flight_status"), false);
  assert.equal(Object.hasOwn(model.flight, "codeshare"), false);
  assert.deepEqual(model.tickets_documents, {
    etkt: [],
    emds: [],
    unclassified: [],
  });
});

test("model creation never invents empty class comments", () => {
  assert.throws(
    () => createFlightImportModel({ class_comments: [{ class: "Y", comment: " " }] }),
    TypeError,
  );
});

test("timing model validates explicit statuses without deriving them", () => {
  assert.deepEqual(
    createTimingModel({
      flight_status: "DELAYED",
      acceptance_status: "OPEN",
    }),
    { flight_status: "DELAYED", acceptance_status: "OPEN" },
  );
  assert.throws(() => createTimingModel({ flight_status: "INFERRED" }), RangeError);
});
