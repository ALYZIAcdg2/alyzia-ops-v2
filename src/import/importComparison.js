import { strictValueEqual } from "../utils/comparisonUtils.js";

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

const AIRCRAFT_FIELDS = Object.freeze(["type", "seatmap_id"]);
const LOAD_COLLECTIONS = Object.freeze([
  ["booked", "BOOKED"],
  ["accepted", "ACCEPTED"],
  ["availability", "AVAILABILITY"],
  ["standby", "STANDBY"],
]);
const LOAD_TOTALS = Object.freeze([
  ["booked_infants", "BOOKED_INFANTS"],
  ["accepted_infants", "ACCEPTED_INFANTS"],
]);
const STRUCTURAL_BLOCKS = Object.freeze([
  "passengers",
  "particularities",
  "tickets_documents",
  "inbound",
  "outbound_connections",
  "groups.items",
  "class_comments",
]);

function own(source, field) {
  return source !== null &&
    typeof source === "object" &&
    Object.hasOwn(source, field);
}

function difference({
  field_path,
  block_path,
  entity_type,
  entity_id = null,
  current_present,
  incoming_present,
  current_value,
  incoming_value,
  operation,
}) {
  if (
    current_present === incoming_present &&
    strictValueEqual(current_value, incoming_value)
  ) {
    return null;
  }
  return {
    field_path,
    block_path,
    entity_type,
    entity_id,
    current_present,
    incoming_present,
    current_value,
    incoming_value,
    operation,
  };
}

function compareScalar({
  current,
  incoming,
  source,
  field,
  path,
  blockPath,
  entityType,
  operation,
}) {
  if (!own(source, field)) {
    return null;
  }
  return difference({
    field_path: `${path}.${field}`,
    block_path: blockPath,
    entity_type: entityType,
    current_present: own(current, field),
    incoming_present: true,
    current_value: current?.[field],
    incoming_value: incoming?.[field],
    operation,
  });
}

function indexedByClass(entries = []) {
  return new Map(entries.map((entry) => [entry.class, entry]));
}

function compareClassCollection({
  current,
  incoming,
  sourcePresent,
  path,
  entityType,
  operation,
  valueField,
  operationMetadata = {},
}) {
  if (!sourcePresent) {
    return [];
  }
  const currentByClass = indexedByClass(current);
  const incomingByClass = indexedByClass(incoming);
  const classes = new Set([...currentByClass.keys(), ...incomingByClass.keys()]);
  return [...classes]
    .sort()
    .map((classCode) => {
      const currentEntry = currentByClass.get(classCode);
      const incomingEntry = incomingByClass.get(classCode);
      return difference({
        field_path: `${path}[class=${classCode}].${valueField}`,
        block_path: path,
        entity_type: entityType,
        entity_id: classCode,
        current_present: currentEntry !== undefined,
        incoming_present: incomingEntry !== undefined,
        current_value: currentEntry?.[valueField],
        incoming_value: incomingEntry?.[valueField],
        operation: {
          ...operation,
          ...operationMetadata,
          class_code: classCode,
        },
      });
    })
    .filter(Boolean);
}

function sourceBlock(source, path) {
  return path.split(".").reduce((value, part) => value?.[part], source);
}

function modelBlock(model, path) {
  return path.split(".").reduce((value, part) => value?.[part], model);
}

function passengerReferenceContext(model) {
  const ticketsByPassenger = new Map();
  for (const ticket of model.tickets_documents?.etkt ?? []) {
    const values = ticketsByPassenger.get(ticket.passenger_id) ?? [];
    values.push(ticket.number);
    ticketsByPassenger.set(ticket.passenger_id, values);
  }
  const referenceMap = new Map();
  const keys = [];
  for (const [index, passenger] of (model.passengers ?? []).entries()) {
    const reference = passenger.temp_id ?? passenger.id ?? index;
    const ticketKey = (ticketsByPassenger.get(reference) ?? []).sort()[0];
    const key = ticketKey
      ? `ETKT:${ticketKey}`
      : `PAX:${passenger.passenger_name_normalized ?? passenger.passenger_name_raw ?? ""}|${passenger.seat ?? ""}|${passenger.cabin_class ?? ""}|${passenger.passenger_type ?? ""}`;
    referenceMap.set(reference, key);
    keys.push(key);
  }
  return {
    referenceMap,
    ambiguous: new Set(keys).size !== keys.length,
  };
}

function referenceKey(context, reference) {
  if (reference === null || reference === undefined) {
    return null;
  }
  return context.referenceMap.get(reference) ?? `UNMATCHED:${String(reference)}`;
}

function sorted(values) {
  return [...values].sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right)),
  );
}

function canonicalPassengers(model, context) {
  return sorted(
    (model.passengers ?? []).map((passenger) => ({
      key: referenceKey(context, passenger.temp_id ?? passenger.id),
      passenger_name_raw: passenger.passenger_name_raw ?? null,
      passenger_name_normalized: passenger.passenger_name_normalized ?? null,
      passenger_type: passenger.passenger_type,
      parent: referenceKey(
        context,
        passenger.parent_ref ?? passenger.parent_passenger_id,
      ),
      cabin_class: passenger.cabin_class ?? null,
      booking_class: passenger.booking_class ?? null,
      seat: passenger.seat ?? null,
      remark: passenger.remark ?? null,
    })),
  );
}

function canonicalParticularities(model, context) {
  return sorted(
    (model.particularities ?? []).map((item) => ({
      category: item.category,
      pax_count: item.pax_count,
      codes: sorted(item.codes ?? []),
      passengers: sorted(
        (item.passenger_ids ?? []).map((reference) =>
          referenceKey(context, reference),
        ),
      ),
    })),
  );
}

function canonicalDocuments(model, context) {
  const documents = model.tickets_documents ?? {};
  return {
    etkt: sorted(
      (documents.etkt ?? []).map((item) => ({
        number: item.number,
        passenger: referenceKey(context, item.passenger_id),
      })),
    ),
    emds: sorted(
      (documents.emds ?? []).map((item) => ({
        number: item.number,
        passenger: referenceKey(context, item.passenger_id),
        associated_code: item.associated_code ?? null,
        remark: item.remark ?? null,
      })),
    ),
    unclassified: sorted(
      (documents.unclassified ?? []).map((item) => ({
        document_value: item.document_value,
        document_hint: item.document_hint ?? null,
        passenger: referenceKey(context, item.passenger_id),
      })),
    ),
  };
}

function canonicalConnections(model, context, field) {
  return sorted(
    (model[field] ?? []).map((item) => {
      const isInbound = field === "inbound";
      const copy = isInbound
        ? {
            inbound_flight: item.inbound_flight,
            origin: item.origin,
            destination: item.destination,
            arrival_time: item.arrival_time ?? null,
            connection_time: item.connection_time ?? null,
            pax_count: item.pax_count ?? null,
            remark: item.remark ?? null,
          }
        : {
            outbound_flight: item.outbound_flight,
            origin: item.origin,
            destination: item.destination,
            std: item.std ?? null,
            connection_time: item.connection_time ?? null,
            total_pax: item.total_pax ?? null,
            final_destination: item.final_destination ?? null,
            terminal: item.terminal ?? null,
            gate: item.gate ?? null,
            remark: item.remark ?? null,
            booked: sorted(item.booked ?? []),
          };
      copy.passenger_ids = sorted(
        (item.passenger_ids ?? []).map((reference) =>
          referenceKey(context, reference),
        ),
      );
      return copy;
    }),
  );
}

function canonicalStructuralBlock(model, path, context) {
  switch (path) {
    case "passengers":
      return canonicalPassengers(model, context);
    case "particularities":
      return canonicalParticularities(model, context);
    case "tickets_documents":
      return canonicalDocuments(model, context);
    case "inbound":
      return canonicalConnections(model, context, "inbound");
    case "outbound_connections":
      return canonicalConnections(model, context, "outbound_connections");
    case "groups.items":
      return sorted(
        (model.groups?.items ?? []).map((item) => ({
          group_name: item.group_name ?? null,
          pax_count: item.pax_count ?? null,
          cabin_class: item.cabin_class ?? null,
          pnr: item.pnr ?? null,
          remark: item.remark ?? null,
        })),
      );
    case "class_comments":
      return sorted(model.class_comments ?? []);
    default:
      return modelBlock(model, path);
  }
}

function compareStructuralBlocks(current, incoming, source) {
  const differences = [];
  const currentReferences = passengerReferenceContext(current);
  const incomingReferences = passengerReferenceContext(incoming);
  for (const path of STRUCTURAL_BLOCKS) {
    const sourceValue = sourceBlock(source, path);
    if (sourceValue === undefined) {
      continue;
    }
    const currentValue = canonicalStructuralBlock(
      current,
      path,
      currentReferences,
    );
    const incomingValue = canonicalStructuralBlock(
      incoming,
      path,
      incomingReferences,
    );
    const ambiguous =
      currentReferences.ambiguous || incomingReferences.ambiguous;
    if (!strictValueEqual(currentValue, incomingValue)) {
      differences.push({
        field_path: path,
        block_path: path,
        entity_type: path.split(".")[0].toUpperCase(),
        entity_id: null,
        current_present: currentValue !== undefined,
        incoming_present: true,
        current_value: currentValue,
        incoming_value: incomingValue,
        operation: {
          type: "REVIEW_STRUCTURAL_BLOCK",
          ambiguous_passenger_matching: ambiguous,
        },
      });
    }
  }
  return differences;
}

export function compareImportModels({ current, incoming, source }) {
  const differences = [];
  const flightRaw = source.flight ?? {};
  const rawTimings = source.timings ?? {};
  const rawAircraft = source.aircraft ?? {};
  const rawLoad = source.load ?? {};
  const rawSummary = source.groups?.summary ?? {};

  differences.push(
    compareScalar({
      current: current.flight,
      incoming: incoming.flight,
      source: flightRaw,
      field: "service_date_raw",
      path: "flight",
      blockPath: "flight",
      entityType: "FLIGHT",
      operation: { type: "UPDATE_FLIGHT_RAW_DATE" },
    }),
  );

  differences.push(
    compareScalar({
      current: current.flight,
      incoming: incoming.flight,
      source: flightRaw,
      field: "movement_type",
      path: "flight",
      blockPath: "flight",
      entityType: "FLIGHT",
      operation: { type: "REVIEW_STRUCTURAL_BLOCK" },
    }),
  );

  for (const field of TIMING_FIELDS) {
    differences.push(
      compareScalar({
        current: current.timings,
        incoming: incoming.timings,
        source: rawTimings,
        field,
        path: "timings",
        blockPath: "timings",
        entityType: "TIMING",
        operation: { type: "UPSERT_TIMING_FIELD", field },
      }),
    );
  }

  for (const field of AIRCRAFT_FIELDS) {
    differences.push(
      compareScalar({
        current: current.aircraft,
        incoming: incoming.aircraft,
        source: rawAircraft,
        field,
        path: "aircraft",
        blockPath: "aircraft",
        entityType: "AIRCRAFT",
        operation: { type: "UPSERT_AIRCRAFT_FIELD", field },
      }),
    );
  }

  differences.push(
    ...compareClassCollection({
      current: current.aircraft.cabin_configuration,
      incoming: incoming.aircraft.cabin_configuration,
      sourcePresent: own(rawAircraft, "cabin_configuration"),
      path: "aircraft.cabin_configuration",
      entityType: "CABIN_CLASS",
      operation: { type: "UPSERT_CABIN_CLASS" },
      valueField: "capacity",
    }),
  );

  for (const [field, loadType] of LOAD_COLLECTIONS) {
    differences.push(
      ...compareClassCollection({
        current: current.load[field],
        incoming: incoming.load[field],
        sourcePresent: own(rawLoad, field),
        path: `load.${field}`,
        entityType: "LOAD_CLASS",
        operation: { type: "UPSERT_LOAD_CLASS" },
        operationMetadata: { load_type: loadType },
        valueField: "value",
      }),
    );
  }

  for (const [field, metric] of LOAD_TOTALS) {
    differences.push(
      compareScalar({
        current: current.load,
        incoming: incoming.load,
        source: rawLoad,
        field,
        path: "load",
        blockPath: `load.${field}`,
        entityType: "LOAD_TOTAL",
        operation: { type: "UPSERT_LOAD_TOTAL", metric },
      }),
    );
  }

  for (const field of ["group_count", "total_group_pax"]) {
    differences.push(
      compareScalar({
        current: current.groups.summary,
        incoming: incoming.groups.summary,
        source: rawSummary,
        field,
        path: "groups.summary",
        blockPath: "groups.summary",
        entityType: "GROUP_SUMMARY",
        operation: { type: "UPSERT_GROUP_SUMMARY_FIELD", field },
      }),
    );
  }

  differences.push(...compareStructuralBlocks(current, incoming, source));
  return differences.filter(Boolean);
}
