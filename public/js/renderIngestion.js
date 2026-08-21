import { dataValue, escapeHtml, formatDateTime } from "./formatters.js";

const STATUS_LABELS = Object.freeze({
  PENDING: "En attente",
  STORED: "Archivé",
  PROCESSED: "Traité",
  NO_CHANGE: "Sans changement",
  REVIEW_REQUIRED: "Révision requise",
  ERROR: "Erreur",
});

function statusTone(status) {
  if (status === "PROCESSED" || status === "STORED") return "is-positive";
  if (status === "NO_CHANGE") return "is-info";
  if (status === "PENDING" || status === "REVIEW_REQUIRED") return "is-warning";
  return "is-negative";
}

function statusPill(status) {
  return `<span class="status-pill ${statusTone(status)}">${escapeHtml(STATUS_LABELS[status] ?? status)}</span>`;
}

export function renderIngestionList(container, ingestions, selectedId = null) {
  if (!Array.isArray(ingestions) || ingestions.length === 0) {
    container.innerHTML = '<p class="empty-block">Aucune ingestion enregistrée.</p>';
    return;
  }
  container.innerHTML = ingestions
    .map(
      (item) => `<button class="import-list-item${item.id === selectedId ? " is-selected" : ""}" type="button" data-ingestion-id="${escapeHtml(item.id)}">
        <span class="import-list-primary"><strong>${escapeHtml(item.id)}</strong>${statusPill(item.ingestion_status)}</span>
        <span class="import-list-secondary">${escapeHtml(item.provider)} · ${escapeHtml(formatDateTime(item.created_at))}</span>
      </button>`,
    )
    .join("");
}

export function renderIngestionDetail(container, payload) {
  const record = payload.ingestion;
  const objects = Array.isArray(payload.objects) ? payload.objects : [];
  container.innerHTML = `<div class="import-detail-heading">
      <div><p class="eyebrow">Ingestion source</p><h3>${escapeHtml(record.id)}</h3></div>
      ${statusPill(record.ingestion_status)}
    </div>
    <dl class="import-meta">
      <div><dt>Fournisseur</dt><dd>${dataValue(record.provider)}</dd></div>
      <div><dt>Import associé</dt><dd>${dataValue(record.import_id)}</dd></div>
      <div><dt>Reçu</dt><dd>${dataValue(record.received_at, { transform: formatDateTime })}</dd></div>
      <div><dt>Créé par</dt><dd>${dataValue(record.created_by)}</dd></div>
      <div><dt>Créé</dt><dd>${dataValue(record.created_at, { transform: formatDateTime })}</dd></div>
      <div><dt>Finalisé</dt><dd>${dataValue(record.processed_at, { transform: formatDateTime })}</dd></div>
    </dl>
    <section class="import-section"><h4>Objets archivés dans R2</h4>${
      objects.length === 0
        ? '<p class="empty-block">Aucun objet archivé.</p>'
        : `<div class="import-records">${objects
            .map(
              (object) => `<article>
                <strong>${escapeHtml(object.object_role)} · ${dataValue(object.source_name)}</strong>
                <span>${dataValue(object.media_type)} · ${escapeHtml(object.size_bytes)} octets</span>
                <code>${escapeHtml(object.r2_key)}</code>
              </article>`,
            )
            .join("")}</div>`
    }</section>`;
}

export function renderIngestionError(container, message) {
  container.innerHTML = `<p class="empty-block">${escapeHtml(message)}</p>`;
}
