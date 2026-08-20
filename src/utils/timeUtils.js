function parseClockParts(value) {
  if (typeof value !== "string") {
    return null;
  }

  const compact = /^(\d{2})(\d{2})$/u.exec(value.trim());
  const separated = /^(\d{1,2}):(\d{2})$/u.exec(value.trim());
  const match = compact ?? separated;

  if (!match) {
    return null;
  }

  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

export function isValidTime(value) {
  const parts = parseClockParts(value);
  return Boolean(
    parts &&
      parts.hours >= 0 &&
      parts.hours <= 23 &&
      parts.minutes >= 0 &&
      parts.minutes <= 59,
  );
}

export function normalizeTime(value) {
  if (value === undefined || value === null) {
    return value;
  }

  const parts = parseClockParts(value);
  if (!parts || !isValidTime(value)) {
    throw new RangeError(`invalid clock time: ${value}`);
  }

  return `${String(parts.hours).padStart(2, "0")}:${String(parts.minutes).padStart(2, "0")}`;
}

function parseDurationParts(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d+):?(\d{2})$/u.exec(value.trim());
  if (!match) {
    return null;
  }

  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

export function normalizeDuration(value) {
  if (value === undefined || value === null) {
    return value;
  }

  const parts = parseDurationParts(value);
  if (!parts || parts.minutes > 59) {
    throw new RangeError(`invalid duration: ${value}`);
  }

  return `${String(parts.hours).padStart(2, "0")}:${String(parts.minutes).padStart(2, "0")}`;
}

export function durationToMinutes(value) {
  const normalized = normalizeDuration(value);
  if (normalized === undefined || normalized === null) {
    return normalized;
  }

  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}
