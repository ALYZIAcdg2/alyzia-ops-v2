import { createFlightImportModel } from "../models/flightImportModel.js";
import { isValidIsoDate } from "../utils/dateUtils.js";
import {
  buildFlightId,
  parseFlightId,
} from "../utils/flightIdentityUtils.js";
import { normalizePassengerName } from "../utils/normalizePassengerName.js";
import { normalizeSeat } from "../utils/normalizeSeat.js";
import { normalizeDuration, normalizeTime } from "../utils/timeUtils.js";
import { validateFlightCreationShape } from "./flightInputShape.js";
import {
  assertNonNegativeInteger,
  assertRecord,
  assertUniqueClassCodes,
  fail,
  isRecord,
  normalizeClassCode,
  optionalString,
  requiredString,
  validateOptionalStrings,
} from "./validationPrimitives.js";

function normalizeClockFields(target, fields, path) {
  for (const field of fields) {
    if (Object.hasOwn(target, field)) {
      try {
        target[field] = normalizeTime(target[field]);
      } catch (error) {
        fail(`${path}.${field}`, error.message);
      }
    }
  }
}

function normalizeDurationField(target, field, path) {
  if (!Object.hasOwn(target, field)) {
    return;
  }
  try {
    target[field] = normalizeDuration(target[field]);
  } catch (error) {
    fail(`${path}.${field}`, error.message);
  }
}

function assertReference(reference, references, field, { nullable = false } = {}) {
  if (nullable && (reference === undefined || reference === null)) {
    return;
  }
  if (typeof reference !== "string" || !references.has(reference)) {
    fail(field, `${field} must reference a passenger temp_id from this payload`);
  }
}

function normalizeFlight(model) {
  const flight = model.flight;
  for (const field of [
    "airline",
    "flight_number",
    "service_date_internal",
    "origin",
    "destination",
    "movement_type",
  ]) {
    requiredString(flight[field], `flight.${field}`);
  }
  if (!isValidIsoDate(flight.service_date_internal)) {
    fail(
      "flight.service_date_internal",
      "flight.service_date_internal must be a reliable ISO date (YYYY-MM-DD)",
    );
  }
  if (Object.hasOwn(flight, "service_date_raw")) {
    optionalString(flight.service_date_raw, "flight.service_date_raw");
  }

  let flightId;
  try {
    flightId = buildFlightId(flight);
  } catch (error) {
    fail("flight", error.message);
  }
  if (flight.flight_id !== undefined && flight.flight_id !== flightId) {
    fail("flight.flight_id", "flight.flight_id does not match the canonical identity");
  }

  const identity = parseFlightId(flightId);
  model.flight = {
    ...flight,
    ...identity,
    movement_type: flight.movement_type.trim().toUpperCase(),
    flight_id: flightId,
  };
}

function normalizeAircraft(model) {
  validateOptionalStrings(model.aircraft, ["type", "seatmap_id"], "aircraft");
  const configuration = model.aircraft.cabin_configuration;
  if (configuration === undefined) {
    return;
  }
  configuration.forEach((entry, index) => {
    entry.class = normalizeClassCode(
      entry.class,
      `aircraft.cabin_configuration[${index}].class`,
    );
    assertNonNegativeInteger(
      entry.capacity,
      `aircraft.cabin_configuration[${index}].capacity`,
    );
  });
  assertUniqueClassCodes(configuration, "aircraft.cabin_configuration");
}

function normalizeLoad(model) {
  for (const field of ["booked", "accepted", "availability", "standby"]) {
    const values = model.load[field];
    if (values === undefined) {
      continue;
    }
    values.forEach((entry, index) => {
      entry.class = normalizeClassCode(entry.class, `load.${field}[${index}].class`);
      if (!Object.hasOwn(entry, "value")) {
        fail(`load.${field}[${index}].value`, "load class value is required");
      }
      assertNonNegativeInteger(entry.value, `load.${field}[${index}].value`);
    });
    assertUniqueClassCodes(values, `load.${field}`);
  }
  for (const field of ["booked_infants", "accepted_infants"]) {
    if (Object.hasOwn(model.load, field)) {
      assertNonNegativeInteger(model.load[field], `load.${field}`);
    }
  }
}

function normalizePassengers(model) {
  const references = new Set();
  model.passengers.forEach((passenger, index) => {
    if (Object.hasOwn(passenger, "temp_id")) {
      passenger.temp_id = requiredString(
        passenger.temp_id,
        `passengers[${index}].temp_id`,
      );
      if (references.has(passenger.temp_id)) {
        fail(`passengers[${index}].temp_id`, "passenger temp_id must be unique");
      }
      references.add(passenger.temp_id);
    }
    requiredString(passenger.passenger_type, `passengers[${index}].passenger_type`);
    for (const field of ["etkt", "emds", "codes", "connection_refs"]) {
      if (passenger[field].length > 0) {
        fail(
          `passengers[${index}].${field}`,
          `passengers.${field} is derived; use the corresponding top-level block`,
        );
      }
    }
    if (Object.hasOwn(passenger, "passenger_name_raw")) {
      optionalString(
        passenger.passenger_name_raw,
        `passengers[${index}].passenger_name_raw`,
      );
    }
    validateOptionalStrings(
      passenger,
      [
        "passenger_name_normalized",
        "cabin_class",
        "booking_class",
        "seat",
        "remark",
      ],
      `passengers[${index}]`,
    );
    if (passenger.passenger_name_normalized !== undefined) {
      passenger.passenger_name_normalized = normalizePassengerName(
        passenger.passenger_name_normalized,
      );
    } else if (typeof passenger.passenger_name_raw === "string") {
      passenger.passenger_name_normalized = normalizePassengerName(
        passenger.passenger_name_raw,
      );
    }
    if (Object.hasOwn(passenger, "seat")) {
      passenger.seat = normalizeSeat(passenger.seat);
    }
    for (const field of ["cabin_class", "booking_class"]) {
      if (typeof passenger[field] === "string" && passenger[field].trim() !== "") {
        passenger[field] = passenger[field].trim().toUpperCase();
      }
    }
  });

  model.passengers.forEach((passenger, index) => {
    if (Object.hasOwn(passenger, "parent_ref")) {
      assertReference(
        passenger.parent_ref,
        references,
        `passengers[${index}].parent_ref`,
      );
      if (passenger.parent_ref === passenger.temp_id) {
        fail(`passengers[${index}].parent_ref`, "a passenger cannot be its own parent");
      }
    }
  });
  return references;
}

function normalizeParticularities(model, references) {
  model.particularities.forEach((item, index) => {
    item.category = requiredString(
      item.category,
      `particularities[${index}].category`,
    ).toUpperCase();
    if (Object.hasOwn(item, "pax_count")) {
      assertNonNegativeInteger(
        item.pax_count,
        `particularities[${index}].pax_count`,
      );
    }
    if (item.codes.length === 0) {
      fail(`particularities[${index}].codes`, "at least one exact code is required");
    }
    item.codes.forEach((entry, codeIndex) => {
      entry.code = requiredString(
        entry.code,
        `particularities[${index}].codes[${codeIndex}].code`,
      );
      if (Object.hasOwn(entry, "count")) {
        assertNonNegativeInteger(
          entry.count,
          `particularities[${index}].codes[${codeIndex}].count`,
        );
      }
    });
    item.passenger_ids.forEach((reference, passengerIndex) =>
      assertReference(
        reference,
        references,
        `particularities[${index}].passenger_ids[${passengerIndex}]`,
      ),
    );
  });
}

function normalizeDocuments(model, references) {
  const documentGroups = [
    ["etkt", "number", false],
    ["emds", "number", false],
    ["unclassified", "document_value", true],
  ];
  for (const [group, valueField, passengerNullable] of documentGroups) {
    model.tickets_documents[group].forEach((document, index) => {
      requiredString(
        document[valueField],
        `tickets_documents.${group}[${index}].${valueField}`,
      );
      assertReference(
        document.passenger_id,
        references,
        `tickets_documents.${group}[${index}].passenger_id`,
        { nullable: passengerNullable },
      );
      if (group === "emds") {
        validateOptionalStrings(
          document,
          ["associated_code", "remark"],
          `tickets_documents.${group}[${index}]`,
        );
      }
      if (group === "unclassified") {
        validateOptionalStrings(
          document,
          ["document_hint"],
          `tickets_documents.${group}[${index}]`,
        );
      }
    });
  }
}

function normalizeConnections(model, references) {
  model.inbound.forEach((connection, index) => {
    const path = `inbound[${index}]`;
    for (const field of ["inbound_flight", "origin", "destination"]) {
      connection[field] = requiredString(connection[field], `${path}.${field}`).toUpperCase();
    }
    normalizeClockFields(connection, ["arrival_time"], path);
    normalizeDurationField(connection, "connection_time", path);
    validateOptionalStrings(connection, ["remark"], path);
    if (Object.hasOwn(connection, "pax_count")) {
      assertNonNegativeInteger(connection.pax_count, `${path}.pax_count`);
    }
    connection.passenger_ids.forEach((reference, passengerIndex) =>
      assertReference(
        reference,
        references,
        `${path}.passenger_ids[${passengerIndex}]`,
      ),
    );
  });

  model.outbound_connections.forEach((connection, index) => {
    const path = `outbound_connections[${index}]`;
    for (const field of ["outbound_flight", "origin", "destination"]) {
      connection[field] = requiredString(connection[field], `${path}.${field}`).toUpperCase();
    }
    normalizeClockFields(connection, ["std"], path);
    normalizeDurationField(connection, "connection_time", path);
    validateOptionalStrings(
      connection,
      ["final_destination", "terminal", "gate", "remark"],
      path,
    );
    if (Object.hasOwn(connection, "total_pax")) {
      assertNonNegativeInteger(connection.total_pax, `${path}.total_pax`);
    }
    connection.booked.forEach((entry, bookedIndex) => {
      entry.class = normalizeClassCode(entry.class, `${path}.booked[${bookedIndex}].class`);
      assertNonNegativeInteger(entry.pax, `${path}.booked[${bookedIndex}].pax`);
    });
    connection.passenger_ids.forEach((reference, passengerIndex) =>
      assertReference(
        reference,
        references,
        `${path}.passenger_ids[${passengerIndex}]`,
      ),
    );
  });
}

function normalizeGroups(model) {
  for (const field of ["group_count", "total_group_pax"]) {
    if (Object.hasOwn(model.groups.summary, field)) {
      assertNonNegativeInteger(model.groups.summary[field], `groups.summary.${field}`);
    }
  }
  model.groups.items.forEach((item, index) => {
    validateOptionalStrings(
      item,
      ["group_name", "cabin_class", "pnr", "remark"],
      `groups.items[${index}]`,
    );
    if (Object.hasOwn(item, "pax_count")) {
      assertNonNegativeInteger(item.pax_count, `groups.items[${index}].pax_count`);
    }
    if (typeof item.cabin_class === "string" && item.cabin_class.trim() !== "") {
      item.cabin_class = item.cabin_class.trim().toUpperCase();
    }
  });
  model.class_comments.forEach((item, index) => {
    item.class = normalizeClassCode(item.class, `class_comments[${index}].class`);
    optionalString(item.comment, `class_comments[${index}].comment`);
  });
}

function rejectUnsupportedPersistenceBlocks(input) {
  if (isRecord(input.airline_extensions) && Object.keys(input.airline_extensions).length > 0) {
    fail("airline_extensions", "airline_extensions persistence is not available in Lot 2");
  }
  if (isRecord(input.import) && Object.keys(input.import).length > 0) {
    fail("import", "direct flight creation cannot create an import record");
  }
  if (Array.isArray(input.issues) && input.issues.length > 0) {
    fail("issues", "direct flight creation cannot persist import issues");
  }
}

export function normalizeFlightCreationInput(input) {
  assertRecord(input, "payload");
  validateFlightCreationShape(input);
  rejectUnsupportedPersistenceBlocks(input);

  let model;
  try {
    model = createFlightImportModel(input);
  } catch (error) {
    fail("payload", error.message);
  }

  normalizeFlight(model);
  normalizeClockFields(
    model.timings,
    ["std", "etd", "atd", "boarding_time"],
    "timings",
  );
  validateOptionalStrings(
    model.timings,
    ["status_validated_at", "status_validated_by"],
    "timings",
  );
  normalizeAircraft(model);
  normalizeLoad(model);
  const references = normalizePassengers(model);
  normalizeParticularities(model, references);
  normalizeDocuments(model, references);
  normalizeConnections(model, references);
  normalizeGroups(model);
  return model;
}
