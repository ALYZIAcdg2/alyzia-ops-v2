import { createFlightImportModel } from "../../models/flightImportModel.js";
import { resolveServiceDateInternal } from "../../utils/dateUtils.js";
import { classifyDocument } from "../../utils/documentUtils.js";
import { buildFlightId } from "../../utils/flightIdentityUtils.js";
import {
  createBlockingIssue,
  createInfoIssue,
  createReviewIssue,
  createWarningIssue,
} from "../../utils/issueFactory.js";
import { classifySsrCode } from "../../utils/ssrUtils.js";
import { normalizeTime } from "../../utils/timeUtils.js";
import {
  SQ_ACCEPTANCE_STATUSES,
  SQ_FLIGHT_STATUSES,
  SQ_MAX_SOURCE_CHARACTERS,
  SQ_MOVEMENT_TYPES,
  SQ_PARSER_NAME,
  SQ_PARSER_VERSION,
} from "./sqParserConstants.js";
import {
  parseSqAircraft,
  parseSqCabin,
  parseSqDocument,
  parseSqFlightHeader,
  parseSqLoad,
  parseSqMovement,
  parseSqPassenger,
  parseSqRoute,
  parseSqServiceDate,
  parseSqSsr,
  parseSqStatus,
  parseSqTiming,
} from "./sqLineParser.js";

function parserIssue(factory, issueCode, fieldPath, message, incomingValue) {
  return factory({
    issue_code: issueCode,
    field_path: fieldPath,
    ...(incomingValue === undefined ? {} : { incoming_value: incomingValue }),
    message,
  });
}

function assignOnce(target, field, value, issues, fieldPath) {
  if (value === null || value === undefined) {
    return;
  }
  if (Object.hasOwn(target, field) && target[field] !== value) {
    issues.push(
      parserIssue(
        createReviewIssue,
        "SQ_CONFLICTING_EXPLICIT_VALUES",
        fieldPath,
        "The SQ source contains conflicting explicit values for this field.",
        value,
      ),
    );
    return;
  }
  target[field] = value;
}

function addKeyedValue(target, field, item, issues, fieldPath) {
  target[field] ??= [];
  const existing = target[field].find((entry) => entry.class === item.class);
  if (!existing) {
    target[field].push(item);
    return;
  }
  if (existing.value !== item.value) {
    issues.push(
      parserIssue(
        createReviewIssue,
        "SQ_CONFLICTING_EXPLICIT_VALUES",
        fieldPath,
        "The SQ source contains conflicting explicit class values.",
        item,
      ),
    );
  }
}

function resolvePassengerReferences(references, passengerIds, issues, lineNumber) {
  const resolved = [];
  for (const reference of references) {
    if (!passengerIds.has(reference)) {
      issues.push(
        parserIssue(
          createReviewIssue,
          "SQ_PASSENGER_REFERENCE_UNRESOLVED",
          `source.lines[${lineNumber}]`,
          "An SSR or document references a passenger not explicitly parsed.",
          reference,
        ),
      );
      continue;
    }
    resolved.push(reference);
  }
  return resolved;
}

function particularitiesFromSsrs(ssrs) {
  const categories = new Map();
  for (const ssr of ssrs) {
    const classification = classifySsrCode(ssr.code, {
      isSpecialMeal: ssr.is_special_meal,
    });
    const category = categories.get(classification.category) ?? {
      category: classification.category,
      codes: new Map(),
      passenger_ids: new Set(),
      has_unidentified_occurrence: false,
    };
    category.codes.set(
      classification.code,
      (category.codes.get(classification.code) ?? 0) + 1,
    );
    for (const passengerId of ssr.passenger_ids) {
      category.passenger_ids.add(passengerId);
    }
    if (ssr.passenger_ids.length === 0) {
      category.has_unidentified_occurrence = true;
    }
    categories.set(classification.category, category);
  }

  return [...categories.values()].map((item) => ({
    category: item.category,
    ...(!item.has_unidentified_occurrence
      ? { pax_count: item.passenger_ids.size }
      : {}),
    codes: [...item.codes].map(([code, count]) => ({ code, count })),
    passenger_ids: [...item.passenger_ids],
  }));
}

function classifiedDocument(document, passengerIds, issues, lineNumber) {
  const references = resolvePassengerReferences(
    document.passenger_refs,
    passengerIds,
    issues,
    lineNumber,
  );
  const passengerId = references[0];
  const classified = classifyDocument({
    value: document.value,
    explicitType: document.explicit_type,
    passenger_id: passengerId,
    associated_code: document.associated_code,
    remark: document.remark,
    document_hint: document.document_hint,
  });
  if (classified.type !== "UNCLASSIFIED" && passengerId === undefined) {
    issues.push(
      parserIssue(
        createBlockingIssue,
        "SQ_DOCUMENT_PASSENGER_REQUIRED",
        `source.lines[${lineNumber}]`,
        "An explicitly classified ETKT or EMD requires one identified passenger.",
      ),
    );
  }
  if (references.length > 1) {
    issues.push(
      parserIssue(
        createReviewIssue,
        "SQ_DOCUMENT_MULTIPLE_PASSENGERS",
        `source.lines[${lineNumber}]`,
        "One explicit document cannot be assigned to multiple passengers automatically.",
      ),
    );
  }
  return classified;
}

function pushDocument(target, classified) {
  if (classified.type === "ETKT") {
    target.etkt.push({
      number: classified.etkt_number,
      ...(classified.passenger_id === undefined
        ? {}
        : { passenger_id: classified.passenger_id }),
    });
    return;
  }
  if (classified.type === "EMD") {
    target.emds.push({
      number: classified.emd_number,
      ...(classified.passenger_id === undefined
        ? {}
        : { passenger_id: classified.passenger_id }),
      ...(classified.associated_code === undefined
        ? {}
        : { associated_code: classified.associated_code }),
      ...(classified.remark === undefined ? {} : { remark: classified.remark }),
    });
    return;
  }
  target.unclassified.push({
    document_value: classified.document_value,
    ...(classified.passenger_id === undefined
      ? {}
      : { passenger_id: classified.passenger_id }),
    ...(classified.document_hint === undefined
      ? {}
      : { document_hint: classified.document_hint }),
  });
}

function validateRequiredIdentity(flight, issues) {
  const required = [
    "airline",
    "flight_number",
    "service_date_raw",
    "service_date_internal",
    "origin",
    "destination",
    "movement_type",
  ];
  for (const field of required) {
    if (flight[field] === undefined || flight[field] === null || flight[field] === "") {
      issues.push(
        parserIssue(
          createBlockingIssue,
          "SQ_REQUIRED_FIELD_MISSING",
          `flight.${field}`,
          "The SQ source and explicit parser options do not provide this required field.",
        ),
      );
    }
  }
}

function normalizeParserOptions(options) {
  if (options === undefined) {
    return {};
  }
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("SQ parser options must be an object");
  }
  return options;
}

export function parseSqEditing({ source_text, options } = {}) {
  if (typeof source_text !== "string" || source_text.trim() === "") {
    throw new TypeError("SQ source_text must be a non-empty string");
  }
  if (source_text.length > SQ_MAX_SOURCE_CHARACTERS) {
    throw new RangeError(
      `SQ source_text cannot exceed ${SQ_MAX_SOURCE_CHARACTERS} characters`,
    );
  }

  const parserOptions = normalizeParserOptions(options);
  const issues = [];
  const flight = {};
  const timings = {};
  const aircraft = {};
  const load = {};
  const passengers = [];
  const passengerIds = new Set();
  const pendingSsrs = [];
  const pendingDocuments = [];
  const matchedLines = new Set();
  const lines = source_text.replace(/^\uFEFF/u, "").split(/\r?\n/u);

  lines.forEach((sourceLine, index) => {
    const lineNumber = index + 1;
    const line = sourceLine.trim();
    if (!line) {
      return;
    }

    const header = parseSqFlightHeader(line);
    if (header) {
      assignOnce(flight, "airline", header.airline, issues, "flight.airline");
      assignOnce(
        flight,
        "flight_number",
        header.flight_number,
        issues,
        "flight.flight_number",
      );
      assignOnce(
        flight,
        "service_date_raw",
        header.service_date_raw,
        issues,
        "flight.service_date_raw",
      );
      matchedLines.add(lineNumber);
    }

    const serviceDate = parseSqServiceDate(line);
    if (serviceDate) {
      assignOnce(
        flight,
        "service_date_raw",
        serviceDate,
        issues,
        "flight.service_date_raw",
      );
      matchedLines.add(lineNumber);
    }

    const route = parseSqRoute(line);
    if (route) {
      assignOnce(flight, "origin", route.origin, issues, "flight.origin");
      assignOnce(
        flight,
        "destination",
        route.destination,
        issues,
        "flight.destination",
      );
      matchedLines.add(lineNumber);
    }

    const movement = parseSqMovement(line);
    if (movement) {
      assignOnce(
        flight,
        "movement_type",
        movement,
        issues,
        "flight.movement_type",
      );
      matchedLines.add(lineNumber);
    }

    const timing = parseSqTiming(line);
    if (timing) {
      try {
        assignOnce(
          timings,
          timing.field,
          normalizeTime(timing.value),
          issues,
          `timings.${timing.field}`,
        );
      } catch {
        issues.push(
          parserIssue(
            createReviewIssue,
            "SQ_TIME_INVALID",
            `timings.${timing.field}`,
            "The explicit SQ time is invalid and was not imported.",
            timing.value,
          ),
        );
      }
      matchedLines.add(lineNumber);
    }

    const status = parseSqStatus(line);
    if (status) {
      const allowed =
        status.field === "flight_status"
          ? SQ_FLIGHT_STATUSES
          : SQ_ACCEPTANCE_STATUSES;
      if (allowed.includes(status.value)) {
        assignOnce(
          timings,
          status.field,
          status.value,
          issues,
          `timings.${status.field}`,
        );
      } else {
        issues.push(
          parserIssue(
            createReviewIssue,
            "SQ_STATUS_INVALID",
            `timings.${status.field}`,
            "The explicit SQ status is outside the validated status list.",
            status.value,
          ),
        );
      }
      matchedLines.add(lineNumber);
    }

    const aircraftField = parseSqAircraft(line);
    if (aircraftField) {
      assignOnce(
        aircraft,
        aircraftField.field,
        aircraftField.value,
        issues,
        `aircraft.${aircraftField.field}`,
      );
      matchedLines.add(lineNumber);
    }

    const cabin = parseSqCabin(line);
    if (cabin) {
      aircraft.cabin_configuration ??= [];
      const existing = aircraft.cabin_configuration.find(
        (entry) => entry.class === cabin.class,
      );
      if (!existing) {
        aircraft.cabin_configuration.push(cabin);
      } else if (existing.capacity !== cabin.capacity) {
        issues.push(
          parserIssue(
            createReviewIssue,
            "SQ_CONFLICTING_EXPLICIT_VALUES",
            `aircraft.cabin_configuration[class=${cabin.class}]`,
            "The SQ source contains conflicting cabin capacities.",
            cabin,
          ),
        );
      }
      matchedLines.add(lineNumber);
    }

    const loadValue = parseSqLoad(line);
    if (loadValue) {
      if (loadValue.class === undefined) {
        assignOnce(
          load,
          loadValue.field,
          loadValue.value,
          issues,
          `load.${loadValue.field}`,
        );
      } else {
        addKeyedValue(
          load,
          loadValue.field,
          { class: loadValue.class, value: loadValue.value },
          issues,
          `load.${loadValue.field}[class=${loadValue.class}]`,
        );
      }
      matchedLines.add(lineNumber);
    }

    const passenger = parseSqPassenger(line);
    if (passenger) {
      if (passengerIds.has(passenger.temp_id)) {
        issues.push(
          parserIssue(
            createBlockingIssue,
            "SQ_PASSENGER_REFERENCE_DUPLICATE",
            `source.lines[${lineNumber}]`,
            "Passenger references must be unique inside one SQ source.",
            passenger.temp_id,
          ),
        );
      } else {
        passengerIds.add(passenger.temp_id);
        passengers.push(passenger);
      }
      matchedLines.add(lineNumber);
    }

    const ssr = parseSqSsr(line);
    if (ssr) {
      pendingSsrs.push({ ...ssr, line_number: lineNumber });
      matchedLines.add(lineNumber);
    }

    const document = parseSqDocument(line);
    if (document) {
      pendingDocuments.push({ ...document, line_number: lineNumber });
      matchedLines.add(lineNumber);
    }
  });

  for (const field of ["origin", "destination", "movement_type"]) {
    const optionValue = parserOptions[field];
    if (typeof optionValue === "string" && optionValue.trim() !== "") {
      const normalized = optionValue.trim().toUpperCase();
      if (field === "movement_type" && !SQ_MOVEMENT_TYPES.includes(normalized)) {
        issues.push(
          parserIssue(
            createBlockingIssue,
            "SQ_MOVEMENT_TYPE_INVALID",
            "options.movement_type",
            "movement_type must be DEPARTURE or ARRIVAL.",
            optionValue,
          ),
        );
      } else {
        assignOnce(flight, field, normalized, issues, `flight.${field}`);
      }
    }
  }

  if (flight.service_date_raw !== undefined) {
    const resolvedDate = resolveServiceDateInternal(flight.service_date_raw, {
      year: parserOptions.service_year,
    });
    if (resolvedDate.service_date_internal) {
      flight.service_date_internal = resolvedDate.service_date_internal;
    } else {
      issues.push(
        parserIssue(
          createBlockingIssue,
          resolvedDate.issue_code ?? "DATE_INVALID",
          "flight.service_date_internal",
          "The SQ service date cannot be resolved reliably without a valid explicit year.",
          flight.service_date_raw,
        ),
      );
    }
  }

  validateRequiredIdentity(flight, issues);
  if (
    ["airline", "flight_number", "service_date_internal", "origin", "destination"].every(
      (field) => typeof flight[field] === "string" && flight[field] !== "",
    )
  ) {
    flight.flight_id = buildFlightId(flight);
  }

  const parsedSsrs = pendingSsrs.map((ssr) => ({
    ...ssr,
    passenger_ids: resolvePassengerReferences(
      ssr.passenger_refs,
      passengerIds,
      issues,
      ssr.line_number,
    ),
  }));
  if (parsedSsrs.some((ssr) => ssr.passenger_ids.length === 0)) {
    issues.push(
      parserIssue(
        createWarningIssue,
        "SQ_SSR_PAX_COUNT_UNKNOWN",
        "particularities",
        "At least one SSR is preserved without an identified passenger; its category pax_count remains absent.",
      ),
    );
  }

  const ticketsDocuments = { etkt: [], emds: [], unclassified: [] };
  for (const document of pendingDocuments) {
    pushDocument(
      ticketsDocuments,
      classifiedDocument(
        document,
        passengerIds,
        issues,
        document.line_number,
      ),
    );
  }

  const nonEmptyLines = lines
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => line.trim() !== "");
  const unparsedLineNumbers = nonEmptyLines
    .filter(({ number }) => !matchedLines.has(number))
    .map(({ number }) => number);
  if (unparsedLineNumbers.length > 0) {
    issues.push(
      parserIssue(
        createInfoIssue,
        "SQ_SOURCE_LINES_UNPARSED",
        "source",
        `${unparsedLineNumbers.length} non-empty source line(s) were not mapped and were left untouched.`,
        unparsedLineNumbers,
      ),
    );
  }

  const model = createFlightImportModel({
    flight,
    timings,
    aircraft,
    load,
    passengers,
    particularities: particularitiesFromSsrs(parsedSsrs),
    tickets_documents: ticketsDocuments,
    import: {
      import_mode: "MANUAL",
      parser_name: SQ_PARSER_NAME,
      parser_version: SQ_PARSER_VERSION,
    },
    issues,
  });
  const reviewIssues = issues.filter((issue) =>
    ["BLOCKING", "REVIEW"].includes(issue.severity),
  );
  const coreSignals = [
    flight.airline,
    flight.flight_number,
    flight.service_date_raw,
    flight.origin,
    flight.destination,
  ].filter(Boolean).length;

  return {
    parser: {
      name: SQ_PARSER_NAME,
      version: SQ_PARSER_VERSION,
      detected_type: "SQ_EDITING_TEXT",
      detection_confidence: coreSignals / 5,
    },
    can_import: reviewIssues.length === 0,
    model,
    issues,
    diagnostics: {
      line_count: lines.length,
      matched_line_count: matchedLines.size,
      unparsed_line_numbers: unparsedLineNumbers,
    },
  };
}

export default parseSqEditing;
