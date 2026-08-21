import { normalizePassengerName } from "../../utils/normalizePassengerName.js";
import { normalizeSeat } from "../../utils/normalizeSeat.js";

function trimOptional(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function matchLabel(line, label) {
  const match = new RegExp(`^${label}\\s*(?::|=|\\s)\\s*(.+)$`, "iu").exec(
    line.trim(),
  );
  return match ? match[1].trim() : null;
}

export function parseSqFlightHeader(line) {
  const explicit = /^FLIGHT\s*(?::|=|\s)\s*(SQ)\s*[- ]?\s*(\d{1,4}[A-Z]?)\b/iu.exec(
    line.trim(),
  );
  const compact = /\b(SQ)\s*[- ]?\s*(\d{1,4}[A-Z]?)\s*[/ ]\s*(\d{1,2}[A-Z]{3})\b/iu.exec(
    line,
  );
  const match = explicit ?? compact;
  if (!match) {
    return null;
  }
  return {
    airline: match[1].toUpperCase(),
    flight_number: match[2].toUpperCase(),
    ...(compact ? { service_date_raw: compact[3] } : {}),
  };
}

export function parseSqServiceDate(line) {
  const value =
    matchLabel(line, "(?:SERVICE\\s+DATE|DATE)") ??
    parseSqFlightHeader(line)?.service_date_raw;
  const match = value && /^(\d{1,2}[A-Z]{3}|\d{4}-\d{2}-\d{2})\b/iu.exec(value);
  return match ? match[1] : null;
}

export function parseSqRoute(line) {
  const labelled = matchLabel(line, "ROUTE");
  const routeMatch = labelled
    ? /^([A-Z]{3})\s*(?:-|\/|>|\s)\s*([A-Z]{3})\b/iu.exec(labelled)
    : null;
  if (routeMatch) {
    return {
      origin: routeMatch[1].toUpperCase(),
      destination: routeMatch[2].toUpperCase(),
    };
  }

  const header = /\bSQ\s*[- ]?\s*\d{1,4}[A-Z]?\s*[/ ]\s*\d{1,2}[A-Z]{3}\s+([A-Z]{3})\s*[-/]?\s*([A-Z]{3})\b/iu.exec(
    line,
  );
  return header
    ? { origin: header[1].toUpperCase(), destination: header[2].toUpperCase() }
    : null;
}

export function parseSqMovement(line) {
  const value = matchLabel(line, "MOVEMENT(?:\\s+TYPE)?");
  const match = value && /^(DEPARTURE|ARRIVAL)\b/iu.exec(value);
  return match ? match[1].toUpperCase() : null;
}

export function parseSqTiming(line) {
  const fields = [
    ["BOARDING(?:_TIME|\\s+TIME)", "boarding_time"],
    ["STD", "std"],
    ["ETD", "etd"],
    ["ATD", "atd"],
  ];
  for (const [label, field] of fields) {
    const value = matchLabel(line, label);
    if (value !== null) {
      return { field, value: value.split(/\s/u, 1)[0] };
    }
  }
  return null;
}

export function parseSqStatus(line) {
  const flightStatus = matchLabel(line, "(?:FLIGHT\\s+STATUS|STATUS)");
  if (flightStatus !== null) {
    return { field: "flight_status", value: flightStatus.toUpperCase() };
  }
  const acceptanceStatus = matchLabel(line, "ACCEPTANCE(?:\\s+STATUS)?");
  return acceptanceStatus === null
    ? null
    : { field: "acceptance_status", value: acceptanceStatus.toUpperCase() };
}

export function parseSqAircraft(line) {
  const type = matchLabel(line, "AIRCRAFT(?:\\s+TYPE)?");
  if (type !== null) {
    return { field: "type", value: type };
  }
  const seatmap = matchLabel(line, "SEATMAP(?:_ID|\\s+ID)?");
  return seatmap === null ? null : { field: "seatmap_id", value: seatmap };
}

export function parseSqCabin(line) {
  const match = /^CABIN\s+([A-Z0-9_]+)\s*(?::|=|\s)\s*(\d+)\s*$/iu.exec(
    line.trim(),
  );
  return match
    ? { class: match[1].toUpperCase(), capacity: Number(match[2]) }
    : null;
}

export function parseSqLoad(line) {
  const total = /^(BOOKED_INFANTS|ACCEPTED_INFANTS)\s*(?::|=|\s)\s*(\d+)\s*$/iu.exec(
    line.trim(),
  );
  if (total) {
    return { field: total[1].toLowerCase(), value: Number(total[2]) };
  }
  const match = /^(BOOKED|ACCEPTED|AVAILABILITY|STANDBY)\s+([A-Z0-9_]+)\s*(?::|=|\s)\s*(NULL|\d+)\s*$/iu.exec(
    line.trim(),
  );
  if (!match) {
    return null;
  }
  return {
    field: match[1].toLowerCase(),
    class: match[2].toUpperCase(),
    value: match[3].toUpperCase() === "NULL" ? null : Number(match[3]),
  };
}

function passengerFromParts(reference, name, type, cabin, booking, seat) {
  return {
    temp_id: reference.trim().toUpperCase(),
    passenger_name_raw: name.trim(),
    passenger_name_normalized: normalizePassengerName(name),
    passenger_type: type.toUpperCase(),
    ...(trimOptional(cabin) ? { cabin_class: cabin.trim().toUpperCase() } : {}),
    ...(trimOptional(booking)
      ? { booking_class: booking.trim().toUpperCase() }
      : {}),
    ...(trimOptional(seat) ? { seat: normalizeSeat(seat) } : {}),
  };
}

export function parseSqPassenger(line) {
  const delimited = /^PAX\s+([A-Z0-9_-]+)\s*(?:\||:)\s*([^|]+?)\s*\|\s*(ADT|CHLD|INF)(?:\s*\|\s*([^|]*))?(?:\s*\|\s*([^|]*))?(?:\s*\|\s*([^|]*))?\s*$/iu.exec(
    line.trim(),
  );
  if (delimited) {
    return passengerFromParts(...delimited.slice(1, 7));
  }

  const numbered = /^(\d+)[.)]\s+(.+?\/[A-ZÀ-ÖØ-öø-ÿ' -]+?)\s+(ADT|CHLD|INF)(?:\s+([A-Z0-9_]+))?(?:\s+([A-Z0-9_]+))?(?:\s+([0-9]{1,3}[A-Z]))?\s*$/iu.exec(
    line.trim(),
  );
  return numbered
    ? passengerFromParts(`P${numbered[1]}`, ...numbered.slice(2, 7))
    : null;
}

function passengerReferences(line) {
  const labelled = /\bPAX\s*=\s*([A-Z0-9_,/-]+)/iu.exec(line);
  if (labelled) {
    return labelled[1]
      .split(/[,/]/u)
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
  }
  const host = /\/P(\d+(?:,\d+)*)\b/iu.exec(line);
  return host ? host[1].split(",").map((value) => `P${value}`) : [];
}

export function parseSqSsr(line) {
  const match = /\bSSR\s+([A-Z0-9_]{2,20})\b/iu.exec(line);
  if (!match) {
    return null;
  }
  return {
    code: match[1],
    passenger_refs: passengerReferences(line),
    is_special_meal: /\bSPECIAL\s+MEAL\b|\bMEAL\b/iu.test(line),
  };
}

function documentOptions(line) {
  const associated = /\bCODE\s*=\s*([^\s]+)/iu.exec(line)?.[1];
  const remark = /\bREMARK\s*=\s*(.+)$/iu.exec(line)?.[1];
  const hint = /\bHINT\s*=\s*(.+)$/iu.exec(line)?.[1];
  return {
    passenger_refs: passengerReferences(line),
    associated_code: associated,
    remark,
    document_hint: hint,
  };
}

export function parseSqDocument(line) {
  const match = /^(ETKT|EMD|DOC(?:UMENT)?)\s+(\S+)/iu.exec(line.trim());
  if (!match) {
    return null;
  }
  return {
    explicit_type: match[1].toUpperCase().startsWith("DOC")
      ? undefined
      : match[1].toUpperCase(),
    value: match[2],
    ...documentOptions(line),
  };
}
