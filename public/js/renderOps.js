import { escapeHtml, formatDateTime } from "./formatters.js";

function bindingState(value) {
  return value
    ? '<span class="status-pill is-positive">Disponible</span>'
    : '<span class="status-pill is-warning">Non configuré</span>';
}

export function renderOpsSummary(container, payload) {
  const summary = payload.summary ?? {};
  const statusTone =
    payload.status === "OPERATIONAL" ? "is-positive" : "is-warning";
  const metrics = [
    ["Vols", summary.flights],
    ["Imports", summary.imports],
    ["Imports à réviser", summary.imports_review],
    ["Issues ouvertes", summary.open_issues],
    ["Overrides actifs", summary.active_overrides],
    ["Ingestions", summary.ingestions],
    ["Objets R2", summary.archived_objects],
    ["Erreurs ingestion", summary.ingestions_error],
  ];
  container.innerHTML = `<div class="ops-heading">
      <div><p class="eyebrow">État calculé</p><h3>${escapeHtml(payload.status)}</h3></div>
      <span class="status-pill ${statusTone}">${escapeHtml(formatDateTime(payload.generated_at))}</span>
    </div>
    <dl class="ops-metrics">${metrics
      .map(
        ([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? 0)}</dd></div>`,
      )
      .join("")}</dl>
    <div class="ops-bindings">
      <article><strong>D1</strong>${bindingState(payload.bindings?.d1)}</article>
      <article><strong>R2</strong>${bindingState(payload.bindings?.r2)}</article>
      <article><strong>Queues</strong>${bindingState(payload.bindings?.queues)}</article>
    </div>
    <div class="ops-extensions"><h3>Extensions</h3>${(payload.extensions ?? [])
      .map(
        (extension) => `<article>
          <div><strong>${escapeHtml(extension.id)}</strong><span>${escapeHtml(extension.extension_type)}</span></div>
          <span>${escapeHtml(extension.status)} · ${escapeHtml(extension.version ?? "version non définie")}</span>
        </article>`,
      )
      .join("")}</div>`;
}

export function renderOpsError(container, message) {
  container.innerHTML = `<p class="empty-block">${escapeHtml(message)}</p>`;
}
