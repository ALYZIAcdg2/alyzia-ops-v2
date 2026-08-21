import {
  assertArray,
  assertKnownFields,
  assertNestedArray,
  assertRecord,
} from "./validationPrimitives.js";

const TOP_LEVEL_FIELDS = Object.freeze([
  "flight",
  "timings",
  "aircraft",
  "load",
  "passengers",
  "particularities",
  "tickets_documents",
  "inbound",
  "outbound_connections",
  "groups",
  "class_comments",
  "airline_extensions",
  "import",
  "issues",
]);

const FLIGHT_FIELDS = Object.freeze([
  "airline",
  "flight_number",
  "service_date_raw",
  "service_date_internal",
  "origin",
  "destination",
  "movement_type",
  "flight_id",
]);

const TIMING_FIELDS = Object.freeze([
  "std",
  "etd",
  "atd",
  "boarding_time",
  "flight_status",
  "acceptance_status",
  "status_validated_at",
  "status_validated_by",
]);

const PASSENGER_FIELDS = Object.freeze([
  "temp_id",
  "passenger_name_raw",
  "passenger_name_normalized",
  "passenger_type",
  "parent_ref",
  "cabin_class",
  "booking_class",
  "seat",
  "etkt",
  "emds",
  "codes",
  "connection_refs",
  "remark",
]);

function validateCoreBlocks(input) {
  assertKnownFields(input, TOP_LEVEL_FIELDS, "payload");
  assertKnownFields(input.flight ?? {}, FLIGHT_FIELDS, "flight");
  assertKnownFields(input.timings ?? {}, TIMING_FIELDS, "timings");
  assertKnownFields(
    input.aircraft ?? {},
    ["type", "seatmap_id", "cabin_configuration"],
    "aircraft",
  );
  if (Object.hasOwn(input.aircraft ?? {}, "cabin_configuration")) {
    assertNestedArray(
      input.aircraft.cabin_configuration,
      "aircraft.cabin_configuration",
      ["class", "capacity"],
    );
  }

  assertKnownFields(
    input.load ?? {},
    [
      "booked",
      "accepted",
      "availability",
      "standby",
      "booked_infants",
      "accepted_infants",
    ],
    "load",
  );
  for (const block of ["booked", "accepted", "availability", "standby"]) {
    if (Object.hasOwn(input.load ?? {}, block)) {
      assertNestedArray(input.load[block], `load.${block}`, ["class", "value"]);
    }
  }
}

function validatePassengersAndParticularities(input) {
  assertArray(input.passengers ?? [], "passengers");
  input.passengers?.forEach((passenger, index) =>
    assertKnownFields(passenger, PASSENGER_FIELDS, `passengers[${index}]`),
  );

  assertArray(input.particularities ?? [], "particularities");
  input.particularities?.forEach((item, index) => {
    const path = `particularities[${index}]`;
    assertKnownFields(
      item,
      ["category", "pax_count", "codes", "passenger_ids"],
      path,
    );
    assertNestedArray(item.codes ?? [], `${path}.codes`, ["code", "count"]);
    assertArray(item.passenger_ids ?? [], `${path}.passenger_ids`);
  });
}

function validateDocuments(input) {
  assertKnownFields(
    input.tickets_documents ?? {},
    ["etkt", "emds", "unclassified"],
    "tickets_documents",
  );
  const documentFields = {
    etkt: ["number", "passenger_id"],
    emds: ["number", "passenger_id", "associated_code", "remark"],
    unclassified: ["document_value", "document_hint", "passenger_id"],
  };
  for (const [group, fields] of Object.entries(documentFields)) {
    if (Object.hasOwn(input.tickets_documents ?? {}, group)) {
      assertNestedArray(
        input.tickets_documents[group],
        `tickets_documents.${group}`,
        fields,
      );
    }
  }
}

function validateConnections(input) {
  assertArray(input.inbound ?? [], "inbound");
  input.inbound?.forEach((item, index) => {
    const path = `inbound[${index}]`;
    assertKnownFields(
      item,
      [
        "inbound_flight",
        "origin",
        "destination",
        "arrival_time",
        "connection_time",
        "pax_count",
        "passenger_ids",
        "remark",
      ],
      path,
    );
    assertArray(item.passenger_ids ?? [], `${path}.passenger_ids`);
  });

  assertArray(input.outbound_connections ?? [], "outbound_connections");
  input.outbound_connections?.forEach((item, index) => {
    const path = `outbound_connections[${index}]`;
    assertKnownFields(
      item,
      [
        "outbound_flight",
        "origin",
        "destination",
        "std",
        "connection_time",
        "booked",
        "total_pax",
        "passenger_ids",
        "final_destination",
        "terminal",
        "gate",
        "remark",
      ],
      path,
    );
    assertNestedArray(item.booked ?? [], `${path}.booked`, ["class", "pax"]);
    assertArray(item.passenger_ids ?? [], `${path}.passenger_ids`);
  });
}

function validateGroupsAndMetadata(input) {
  assertKnownFields(input.groups ?? {}, ["summary", "items"], "groups");
  assertKnownFields(
    input.groups?.summary ?? {},
    ["group_count", "total_group_pax"],
    "groups.summary",
  );
  assertNestedArray(input.groups?.items ?? [], "groups.items", [
    "group_name",
    "pax_count",
    "cabin_class",
    "pnr",
    "remark",
  ]);
  assertNestedArray(input.class_comments ?? [], "class_comments", [
    "class",
    "comment",
  ]);
  if (Object.hasOwn(input, "airline_extensions")) {
    assertRecord(input.airline_extensions, "airline_extensions");
  }
  if (Object.hasOwn(input, "import")) {
    assertRecord(input.import, "import");
  }
  if (Object.hasOwn(input, "issues")) {
    assertArray(input.issues, "issues");
  }
}

export function validateFlightCreationShape(input) {
  validateCoreBlocks(input);
  validatePassengersAndParticularities(input);
  validateDocuments(input);
  validateConnections(input);
  validateGroupsAndMetadata(input);
}
