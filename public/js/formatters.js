const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const STATUS_LABELS = Object.freeze({
  SCHEDULED: "Programmé",
  DELAYED: "Retardé",
  DEPARTED: "Parti",
  CANCELLED: "Annulé",
  NOT_OPEN: "Non ouverte",
  OPEN: "Ouverte",
  CLOSED: "Fermée",
  UNKNOWN: "Inconnue",
  DEPARTURE: "Départ",
  ARRIVAL: "Arrivée",
  ADT: "Adulte",
  CHLD: "Enfant",
  INF: "Bébé",
});

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return value ?? "";
  }
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : DATE_FORMATTER.format(date);
}

export function formatDateTime(value) {
  if (typeof value !== "string" || value === "") {
    return value ?? "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_TIME_FORMATTER.format(date);
}

export function labelFor(value) {
  return STATUS_LABELS[value] ?? value;
}

export function statusTone(value) {
  if (["DEPARTED", "OPEN"].includes(value)) {
    return "is-positive";
  }
  if (["DELAYED", "UNKNOWN"].includes(value)) {
    return "is-warning";
  }
  if (["CANCELLED", "CLOSED"].includes(value)) {
    return "is-negative";
  }
  return "is-info";
}

export function dataValue(value, { provided = true, transform } = {}) {
  if (!provided || value === undefined) {
    return '<span class="value-absent">Non fourni</span>';
  }
  if (value === null) {
    return '<span class="value-unknown">Inconnu</span>';
  }
  const display = transform ? transform(value) : value;
  return escapeHtml(display);
}

export function joinValues(values, separator = " · ") {
  if (!Array.isArray(values) || values.length === 0) {
    return '<span class="value-absent">Aucun</span>';
  }
  return values.map(escapeHtml).join(escapeHtml(separator));
}
