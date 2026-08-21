import { dataValue, escapeHtml } from "./formatters.js";

function issueTone(severity) {
  if (severity === "BLOCKING") return "is-negative";
  if (severity === "REVIEW" || severity === "WARNING") return "is-warning";
  return "is-info";
}

function renderIssues(issues) {
  if (!Array.isArray(issues) || issues.length === 0) {
    return '<p class="empty-block">Aucune issue de parsing.</p>';
  }
  return `<div class="parse-issues">${issues
    .map(
      (issue) => `<article>
        <span class="status-pill ${issueTone(issue.severity)}">${escapeHtml(issue.severity)}</span>
        <div><strong>${escapeHtml(issue.issue_code)}</strong><p>${escapeHtml(issue.message)}</p><small>${dataValue(issue.field_path)}</small></div>
      </article>`,
    )
    .join("")}</div>`;
}

export function renderSqParse(container, parsed) {
  const flight = parsed.model.flight;
  const confidence = Math.round(parsed.parser.detection_confidence * 100);
  container.innerHTML = `<div class="parse-summary">
      <div>
        <p class="eyebrow">PRÉVISUALISATION SQ</p>
        <h3>${dataValue(flight.flight_id)}</h3>
      </div>
      <span class="status-pill ${parsed.can_import ? "is-positive" : "is-warning"}">
        ${parsed.can_import ? "Prêt à importer" : "Révision requise"}
      </span>
    </div>
    <dl class="import-meta">
      <div><dt>Parser</dt><dd>${escapeHtml(parsed.parser.name)} · ${escapeHtml(parsed.parser.version)}</dd></div>
      <div><dt>Détection</dt><dd>${confidence}%</dd></div>
      <div><dt>Lignes reconnues</dt><dd>${parsed.diagnostics.matched_line_count}/${parsed.diagnostics.line_count}</dd></div>
      <div><dt>Passagers</dt><dd>${parsed.model.passengers.length}</dd></div>
      <div><dt>Particularités</dt><dd>${parsed.model.particularities.length}</dd></div>
      <div><dt>Documents</dt><dd>${parsed.model.tickets_documents.etkt.length + parsed.model.tickets_documents.emds.length + parsed.model.tickets_documents.unclassified.length}</dd></div>
    </dl>
    <section class="import-section"><h4>Issues du parser</h4>${renderIssues(parsed.issues)}</section>`;
}

export function resetSqParse(container) {
  container.innerHTML = '<p class="empty-block">Analysez la source pour vérifier le modèle avant toute écriture D1.</p>';
}
