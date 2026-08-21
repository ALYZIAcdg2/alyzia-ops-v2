import { dataValue, escapeHtml, formatDateTime } from "./formatters.js";

const STATUS_LABELS = Object.freeze({
  PENDING: "En attente",
  PROCESSED: "Traité",
  NO_CHANGE: "Sans changement",
  REVIEW_REQUIRED: "Révision requise",
  ERROR: "Erreur",
});

function statusTone(status) {
  if (status === "PROCESSED") return "is-positive";
  if (status === "NO_CHANGE") return "is-info";
  if (status === "REVIEW_REQUIRED" || status === "PENDING") return "is-warning";
  return "is-negative";
}

function statusPill(status) {
  return `<span class="status-pill ${statusTone(status)}">${escapeHtml(STATUS_LABELS[status] ?? status)}</span>`;
}

export function renderImportList(container, imports, selectedId = null) {
  if (!Array.isArray(imports) || imports.length === 0) {
    container.innerHTML = '<p class="empty-block">Aucun import structuré enregistré.</p>';
    return;
  }
  container.innerHTML = imports
    .map(
      (item) => `<button class="import-list-item${item.id === selectedId ? " is-selected" : ""}" type="button" data-import-id="${escapeHtml(item.id)}">
        <span class="import-list-primary"><strong>${escapeHtml(item.id)}</strong>${statusPill(item.import_status)}</span>
        <span class="import-list-secondary">${dataValue(item.flight_id)} · ${escapeHtml(formatDateTime(item.created_at))}</span>
      </button>`,
    )
    .join("");
}

function renderRows(items, emptyMessage, renderer) {
  if (!Array.isArray(items) || items.length === 0) {
    return `<p class="empty-block">${escapeHtml(emptyMessage)}</p>`;
  }
  return `<div class="import-records">${items.map(renderer).join("")}</div>`;
}

export function renderImportDetail(container, payload) {
  const record = payload.import;
  container.innerHTML = `<div class="import-detail-heading">
      <div><p class="eyebrow">Import structuré</p><h3>${escapeHtml(record.id)}</h3></div>
      ${statusPill(record.import_status)}
    </div>
    <dl class="import-meta">
      <div><dt>Vol</dt><dd>${dataValue(record.flight_id)}</dd></div>
      <div><dt>Portée</dt><dd>${dataValue(record.data_scope)}</dd></div>
      <div><dt>Mode</dt><dd>${dataValue(record.import_mode)}</dd></div>
      <div><dt>Créé par</dt><dd>${dataValue(record.created_by)}</dd></div>
      <div><dt>Démarré</dt><dd>${dataValue(record.started_at, { transform: formatDateTime })}</dd></div>
      <div><dt>Terminé</dt><dd>${dataValue(record.completed_at, { transform: formatDateTime })}</dd></div>
    </dl>
    <section class="import-section"><h4>Sources techniques</h4>${renderRows(payload.sources, "Aucune source technique.", (source) => `<article><strong>${dataValue(source.source_name)}</strong><span>${dataValue(source.source_type)} · ${dataValue(source.file_status)}</span></article>`)}</section>
    <section class="import-section"><h4>Problèmes et décisions</h4>${renderRows(payload.issues, "Aucun problème enregistré.", (issue) => `<article><strong>${escapeHtml(issue.severity)} · ${escapeHtml(issue.issue_code)}</strong><span>${dataValue(issue.field_path)} — ${escapeHtml(issue.message)}</span></article>`)}</section>
    <section class="import-section"><h4>Historique</h4>${renderRows(payload.history, "Aucun changement appliqué.", (entry) => `<article><strong>${escapeHtml(entry.change_action)} · ${escapeHtml(entry.field_path)}</strong><span>${escapeHtml(formatDateTime(entry.changed_at))} · ${dataValue(entry.changed_by)}</span></article>`)}</section>`;
}

export function renderImportError(container, message) {
  container.innerHTML = `<p class="empty-block">${escapeHtml(message)}</p>`;
}
