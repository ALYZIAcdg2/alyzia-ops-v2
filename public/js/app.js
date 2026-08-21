import {
  ApiError,
  archiveGmailSource,
  createFlight,
  createStructuredImport,
  getFlight,
  getHealth,
  getImport,
  getImportSummary,
  getIngestion,
  getOpsSummary,
  getReadiness,
  importSqSource,
  listFlights,
  listImports,
  listIngestions,
  previewSqSource,
  resolveImportIssue,
} from "./api.js";
import { createBrowserFixture } from "./fixture.js";
import {
  renderDetailError,
  renderFlightDetail,
  renderFlightList,
} from "./renderFlight.js";
import {
  renderImportDetail,
  renderImportError,
  renderImportList,
  renderImportSummary,
} from "./renderImport.js";
import {
  renderIngestionDetail,
  renderIngestionError,
  renderIngestionList,
} from "./renderIngestion.js";
import { renderSqParse, resetSqParse } from "./renderSqParse.js";
import { renderOpsError, renderOpsSummary } from "./renderOps.js";

const PAGE_SIZE = 25;

const elements = {
  serviceState: document.querySelector("#service-state"),
  serviceStateLabel: document.querySelector("#service-state-label"),
  apiVersion: document.querySelector("#api-version"),
  visibleCount: document.querySelector("#visible-count"),
  opsToken: document.querySelector("#ops-token"),
  loadOps: document.querySelector("#load-ops"),
  opsSummary: document.querySelector("#ops-summary"),
  searchForm: document.querySelector("#search-form"),
  searchInput: document.querySelector("#flight-search"),
  clearSearch: document.querySelector("#clear-search"),
  refresh: document.querySelector("#refresh-flights"),
  list: document.querySelector("#flight-list"),
  loadMore: document.querySelector("#load-more"),
  detail: document.querySelector("#flight-detail"),
  openFixture: document.querySelector("#open-fixture"),
  closeFixture: document.querySelector("#close-fixture"),
  cancelFixture: document.querySelector("#cancel-fixture"),
  fixtureDialog: document.querySelector("#fixture-dialog"),
  fixtureForm: document.querySelector("#fixture-form"),
  fixtureDate: document.querySelector("#fixture-date"),
  writeToken: document.querySelector("#write-token"),
  fixtureConfirmation: document.querySelector("#fixture-confirmation"),
  submitFixture: document.querySelector("#submit-fixture"),
  openImport: document.querySelector("#open-import"),
  refreshImports: document.querySelector("#refresh-imports"),
  importSummary: document.querySelector("#import-summary"),
  importFilters: document.querySelector("#import-filters"),
  importSearch: document.querySelector("#import-search"),
  importStatusFilter: document.querySelector("#import-status-filter"),
  importModeFilter: document.querySelector("#import-mode-filter"),
  resetImportFilters: document.querySelector("#reset-import-filters"),
  issueResolvedBy: document.querySelector("#issue-resolved-by"),
  issueWriteToken: document.querySelector("#issue-write-token"),
  previousImports: document.querySelector("#previous-imports"),
  nextImports: document.querySelector("#next-imports"),
  importPageLabel: document.querySelector("#import-page-label"),
  importList: document.querySelector("#import-list"),
  importDetail: document.querySelector("#import-detail"),
  importDialog: document.querySelector("#import-dialog"),
  importForm: document.querySelector("#import-form"),
  closeImport: document.querySelector("#close-import"),
  cancelImport: document.querySelector("#cancel-import"),
  importId: document.querySelector("#import-id"),
  importUser: document.querySelector("#import-user"),
  importScope: document.querySelector("#import-scope"),
  importToken: document.querySelector("#import-token"),
  importModel: document.querySelector("#import-model"),
  importConfirmation: document.querySelector("#import-confirmation"),
  submitImport: document.querySelector("#submit-import"),
  openSq: document.querySelector("#open-sq"),
  sqDialog: document.querySelector("#sq-dialog"),
  sqForm: document.querySelector("#sq-form"),
  closeSq: document.querySelector("#close-sq"),
  cancelSq: document.querySelector("#cancel-sq"),
  sqYear: document.querySelector("#sq-year"),
  sqMovement: document.querySelector("#sq-movement"),
  sqOrigin: document.querySelector("#sq-origin"),
  sqDestination: document.querySelector("#sq-destination"),
  sqSourceName: document.querySelector("#sq-source-name"),
  sqUser: document.querySelector("#sq-user"),
  sqScope: document.querySelector("#sq-scope"),
  sqToken: document.querySelector("#sq-token"),
  sqSource: document.querySelector("#sq-source"),
  sqPreview: document.querySelector("#sq-preview"),
  sqConfirmation: document.querySelector("#sq-confirmation"),
  previewSq: document.querySelector("#preview-sq"),
  submitSq: document.querySelector("#submit-sq"),
  openIngestion: document.querySelector("#open-ingestion"),
  refreshIngestions: document.querySelector("#refresh-ingestions"),
  loadIngestions: document.querySelector("#load-ingestions"),
  ingestionListToken: document.querySelector("#ingestion-list-token"),
  ingestionList: document.querySelector("#ingestion-list"),
  ingestionDetail: document.querySelector("#ingestion-detail"),
  previousIngestions: document.querySelector("#previous-ingestions"),
  nextIngestions: document.querySelector("#next-ingestions"),
  ingestionPageLabel: document.querySelector("#ingestion-page-label"),
  ingestionDialog: document.querySelector("#ingestion-dialog"),
  ingestionForm: document.querySelector("#ingestion-form"),
  closeIngestion: document.querySelector("#close-ingestion"),
  cancelIngestion: document.querySelector("#cancel-ingestion"),
  ingestionMessageId: document.querySelector("#ingestion-message-id"),
  ingestionCreatedBy: document.querySelector("#ingestion-created-by"),
  ingestionReceivedAt: document.querySelector("#ingestion-received-at"),
  ingestionToken: document.querySelector("#ingestion-token"),
  ingestionSource: document.querySelector("#ingestion-source"),
  ingestionConfirmation: document.querySelector("#ingestion-confirmation"),
  submitIngestion: document.querySelector("#submit-ingestion"),
  toastRegion: document.querySelector("#toast-region"),
};

const state = {
  flights: [],
  query: "",
  offset: 0,
  hasMore: false,
  selectedFlightId: null,
  listRequest: 0,
  detailRequest: 0,
  imports: [],
  selectedImportId: null,
  importListRequest: 0,
  importDetailRequest: 0,
  importOffset: 0,
  importHasMore: false,
  importQuery: "",
  importStatus: "",
  importMode: "",
  sqParse: null,
  ingestions: [],
  selectedIngestionId: null,
  ingestionListRequest: 0,
  ingestionDetailRequest: 0,
  ingestionOffset: 0,
  ingestionHasMore: false,
};

function errorMessage(error) {
  if (error instanceof ApiError) {
    if (error.code === "WRITE_API_NOT_CONFIGURED") {
      return "L’écriture n’est pas encore configurée : ajoutez le secret Cloudflare API_WRITE_TOKEN au Worker.";
    }
    if (error.code === "WRITE_AUTHORIZATION_REQUIRED") {
      return "Jeton d’écriture incorrect. Vérifiez le secret API_WRITE_TOKEN.";
    }
    if (error.code === "FLIGHT_CONFLICT") {
      return "Cette identité de vol existe déjà dans D1.";
    }
    if (error.code === "IMPORT_NOT_FOUND") return "Import introuvable.";
    if (error.code === "IMPORT_ID_ALREADY_EXISTS") return "Cet identifiant d’import existe déjà.";
    if (error.code === "SQ_REVIEW_REQUIRED") {
      return "Le parser a détecté une ambiguïté : révisez les issues avant l’import.";
    }
    if (error.code === "GMAIL_MESSAGE_ALREADY_INGESTED") {
      return "Ce message Gmail a déjà été archivé.";
    }
    if (error.code === "R2_BINDING_NOT_CONFIGURED") {
      return "Le stockage R2 n’est pas encore relié au Worker.";
    }
    if (error.code === "INGESTION_NOT_FOUND") return "Ingestion introuvable.";
    return error.message;
  }
  return "Le service est momentanément inaccessible.";
}

async function loadOps() {
  const token = elements.opsToken.value;
  if (!token) {
    showToast("Saisissez le jeton d’écriture pour charger la supervision.", "error");
    elements.opsToken.focus();
    return;
  }
  elements.loadOps.disabled = true;
  elements.loadOps.textContent = "Actualisation…";
  try {
    renderOpsSummary(elements.opsSummary, await getOpsSummary(token));
  } catch (error) {
    renderOpsError(elements.opsSummary, errorMessage(error));
    showToast(errorMessage(error), "error");
  } finally {
    elements.loadOps.disabled = false;
    elements.loadOps.textContent = "Actualiser la supervision";
  }
}

function renderIngestions() {
  renderIngestionList(
    elements.ingestionList,
    state.ingestions,
    state.selectedIngestionId,
  );
}

async function selectIngestion(ingestionId) {
  if (!ingestionId) return;
  const token = elements.ingestionListToken.value;
  if (!token) return;
  state.selectedIngestionId = ingestionId;
  renderIngestions();
  const requestId = ++state.ingestionDetailRequest;
  try {
    const payload = await getIngestion(ingestionId, token);
    if (requestId === state.ingestionDetailRequest) {
      renderIngestionDetail(elements.ingestionDetail, payload);
    }
  } catch (error) {
    if (requestId === state.ingestionDetailRequest) {
      renderIngestionError(elements.ingestionDetail, errorMessage(error));
    }
  }
}

async function loadIngestionList({ selectLatest = false } = {}) {
  const token = elements.ingestionListToken.value;
  if (!token) {
    showToast("Saisissez le jeton d’écriture pour consulter les ingestions.", "error");
    elements.ingestionListToken.focus();
    return;
  }
  const requestId = ++state.ingestionListRequest;
  elements.loadIngestions.disabled = true;
  elements.refreshIngestions.disabled = true;
  try {
    const result = await listIngestions(
      { limit: PAGE_SIZE, offset: state.ingestionOffset },
      token,
    );
    if (requestId !== state.ingestionListRequest) return;
    state.ingestions = result.ingestions;
    state.ingestionHasMore = result.pagination.has_more;
    renderIngestions();
    elements.previousIngestions.disabled = state.ingestionOffset === 0;
    elements.nextIngestions.disabled = !state.ingestionHasMore;
    elements.ingestionPageLabel.textContent = `Page ${Math.floor(state.ingestionOffset / PAGE_SIZE) + 1}`;
    const candidate = selectLatest
      ? state.ingestions[0]?.id
      : state.ingestions.some((item) => item.id === state.selectedIngestionId)
        ? state.selectedIngestionId
        : state.ingestions[0]?.id;
    if (candidate) {
      await selectIngestion(candidate);
    } else {
      state.selectedIngestionId = null;
      renderIngestionError(elements.ingestionDetail, "Aucune ingestion enregistrée.");
    }
  } catch (error) {
    if (requestId === state.ingestionListRequest) {
      renderIngestionError(elements.ingestionList, errorMessage(error));
      showToast(errorMessage(error), "error");
    }
  } finally {
    if (requestId === state.ingestionListRequest) {
      elements.loadIngestions.disabled = false;
      elements.refreshIngestions.disabled = false;
    }
  }
}

function renderImports() {
  renderImportList(elements.importList, state.imports, state.selectedImportId);
}

async function selectImport(importId) {
  if (!importId) return;
  state.selectedImportId = importId;
  renderImports();
  const requestId = ++state.importDetailRequest;
  try {
    const payload = await getImport(importId);
    if (requestId === state.importDetailRequest) {
      renderImportDetail(elements.importDetail, payload);
    }
  } catch (error) {
    if (requestId === state.importDetailRequest) {
      renderImportError(elements.importDetail, errorMessage(error));
    }
  }
}

async function loadImports({ selectLatest = false } = {}) {
  const requestId = ++state.importListRequest;
  elements.refreshImports.disabled = true;
  try {
    const [result, summaryResult] = await Promise.all([
      listImports({
        limit: PAGE_SIZE,
        offset: state.importOffset,
        status: state.importStatus,
        mode: state.importMode,
        query: state.importQuery,
      }),
      getImportSummary(),
    ]);
    if (requestId !== state.importListRequest) return;
    state.imports = result.imports;
    state.importHasMore = result.pagination.has_more;
    renderImportSummary(elements.importSummary, summaryResult.summary);
    renderImports();
    elements.previousImports.disabled = state.importOffset === 0;
    elements.nextImports.disabled = !state.importHasMore;
    elements.importPageLabel.textContent = `Page ${Math.floor(state.importOffset / PAGE_SIZE) + 1}`;
    const candidate = selectLatest
      ? state.imports[0]?.id
      : state.imports.some((item) => item.id === state.selectedImportId)
        ? state.selectedImportId
        : state.imports[0]?.id;
    if (candidate) {
      await selectImport(candidate);
    } else {
      state.selectedImportId = null;
      renderImportError(elements.importDetail, "Aucun import ne correspond aux filtres.");
    }
  } catch (error) {
    if (requestId === state.importListRequest) {
      renderImportError(elements.importList, errorMessage(error));
    }
  } finally {
    if (requestId === state.importListRequest) elements.refreshImports.disabled = false;
  }
}

async function decideImportIssue(issueId, resolutionStatus) {
  const importId = state.selectedImportId;
  const resolvedBy = elements.issueResolvedBy.value.trim();
  const writeToken = elements.issueWriteToken.value;
  if (!importId || !resolvedBy || !writeToken) {
    showToast("Renseignez l’opérateur et le jeton d’écriture avant la décision.", "error");
    return;
  }
  const action = resolutionStatus === "RESOLVED" ? "résoudre" : "ignorer";
  if (!window.confirm(`Confirmer : ${action} explicitement cette issue ?`)) return;
  try {
    await resolveImportIssue(
      { importId, issueId, resolutionStatus, resolvedBy },
      writeToken,
    );
    elements.issueWriteToken.value = "";
    showToast("Décision enregistrée. Le statut de l’import reste inchangé.", "success");
    await loadImports();
  } catch (error) {
    elements.issueWriteToken.value = "";
    showToast(errorMessage(error), "error");
  }
}

function showToast(message, tone = "info") {
  const toast = document.createElement("div");
  toast.className = `toast${tone === "info" ? "" : ` is-${tone}`}`;
  toast.setAttribute("role", tone === "error" ? "alert" : "status");
  toast.textContent = message;
  elements.toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 6500);
}

function renderList() {
  renderFlightList(elements.list, state.flights, state.selectedFlightId);
  elements.visibleCount.textContent = String(state.flights.length);
  elements.loadMore.classList.toggle("is-hidden", !state.hasMore);
}

function selectedFromHash() {
  const parameters = new URLSearchParams(window.location.hash.slice(1));
  return parameters.get("flight");
}

function updateHash(flightId) {
  const url = new URL(window.location.href);
  url.hash = `flight=${encodeURIComponent(flightId)}`;
  window.history.replaceState(null, "", url);
}

async function selectFlight(flightId, { updateLocation = true } = {}) {
  if (!flightId) {
    return;
  }
  state.selectedFlightId = flightId;
  renderList();
  if (updateLocation) {
    updateHash(flightId);
  }

  const requestId = ++state.detailRequest;
  elements.detail.classList.add("detail-loading");
  try {
    const { flight } = await getFlight(flightId);
    if (requestId !== state.detailRequest) {
      return;
    }
    renderFlightDetail(elements.detail, flight);
  } catch (error) {
    if (requestId === state.detailRequest) {
      renderDetailError(elements.detail, errorMessage(error));
    }
  } finally {
    if (requestId === state.detailRequest) {
      elements.detail.classList.remove("detail-loading");
    }
  }
}

async function loadFlightList({
  append = false,
  autoSelect = false,
  useHash = false,
} = {}) {
  const requestId = ++state.listRequest;
  elements.refresh.disabled = true;
  elements.loadMore.disabled = true;
  if (!append) {
    elements.list.innerHTML = `
      <div class="list-skeleton" aria-label="Chargement des vols">
        <span></span><span></span><span></span>
      </div>`;
  }

  try {
    const result = await listFlights({
      query: state.query,
      limit: PAGE_SIZE,
      offset: append ? state.offset : 0,
    });
    if (requestId !== state.listRequest) {
      return;
    }
    state.flights = append
      ? [...state.flights, ...result.flights]
      : result.flights;
    state.offset = state.flights.length;
    state.hasMore = result.pagination.has_more;
    renderList();

    const hashFlight = useHash ? selectedFromHash() : null;
    const candidate =
      hashFlight ??
      (autoSelect || !state.selectedFlightId
        ? state.flights[0]?.flight_id
        : state.selectedFlightId);
    if (!append && candidate) {
      await selectFlight(candidate, { updateLocation: hashFlight === null });
    }
  } catch (error) {
    if (requestId === state.listRequest) {
      const message = document.createElement("p");
      message.textContent = errorMessage(error);
      const wrapper = document.createElement("div");
      wrapper.className = "list-message";
      wrapper.append(message);
      elements.list.replaceChildren(wrapper);
      elements.visibleCount.textContent = "—";
      elements.loadMore.classList.add("is-hidden");
      showToast(errorMessage(error), "error");
    }
  } finally {
    if (requestId === state.listRequest) {
      elements.refresh.disabled = false;
      elements.loadMore.disabled = false;
    }
  }
}

async function checkHealth() {
  try {
    const [health, readiness] = await Promise.all([getHealth(), getReadiness()]);
    elements.serviceState.classList.remove("is-loading", "is-offline");
    elements.serviceState.classList.add(readiness.ok ? "is-online" : "is-loading");
    elements.serviceStateLabel.textContent = readiness.ok
      ? "Service opérationnel"
      : "Configuration requise";
    elements.apiVersion.textContent = health.version;
  } catch {
    elements.serviceState.classList.remove("is-loading", "is-online");
    elements.serviceState.classList.add("is-offline");
    elements.serviceStateLabel.textContent = "Service indisponible";
    elements.apiVersion.textContent = "—";
  }
}

function resetFixtureForm() {
  elements.writeToken.value = "";
  elements.fixtureConfirmation.checked = false;
  elements.submitFixture.disabled = false;
  elements.submitFixture.textContent = "Créer la fixture D1";
}

function closeFixtureDialog() {
  resetFixtureForm();
  elements.fixtureDialog.close();
}

function resetImportForm() {
  elements.importToken.value = "";
  elements.importConfirmation.checked = false;
  elements.submitImport.disabled = false;
  elements.submitImport.textContent = "Lancer l’import";
}

function closeImportDialog() {
  resetImportForm();
  elements.importDialog.close();
}

function resetIngestionForm() {
  elements.ingestionMessageId.value = "";
  elements.ingestionCreatedBy.value = "";
  elements.ingestionReceivedAt.value = "";
  elements.ingestionToken.value = "";
  elements.ingestionSource.value = "";
  elements.ingestionConfirmation.checked = false;
  elements.submitIngestion.disabled = false;
  elements.submitIngestion.textContent = "Archiver dans R2";
}

function closeIngestionDialog() {
  resetIngestionForm();
  elements.ingestionDialog.close();
}

function openIngestionDialog() {
  elements.ingestionMessageId.value = `FIXTURE-GMAIL-${crypto.randomUUID().toUpperCase()}`;
  elements.ingestionCreatedBy.value = "FIXTURE_WEB_OPERATOR";
  elements.ingestionReceivedAt.value = new Date().toISOString().slice(0, 19);
  elements.ingestionDialog.showModal();
}

async function submitIngestion(event) {
  event.preventDefault();
  if (!elements.ingestionForm.reportValidity()) return;
  const token = elements.ingestionToken.value;
  const receivedAt = elements.ingestionReceivedAt.value;
  elements.submitIngestion.disabled = true;
  elements.submitIngestion.textContent = "Archivage…";
  try {
    const { result } = await archiveGmailSource(
      {
        provider_message_id: elements.ingestionMessageId.value.trim(),
        created_by: elements.ingestionCreatedBy.value.trim(),
        ...(receivedAt ? { received_at: `${receivedAt}Z` } : {}),
        text_content: elements.ingestionSource.value,
      },
      token,
    );
    elements.ingestionListToken.value = token;
    state.selectedIngestionId = result.ingestion_id;
    state.ingestionOffset = 0;
    closeIngestionDialog();
    showToast(`Source ${result.ingestion_id} archivée dans R2.`, "success");
    await loadIngestionList({ selectLatest: true });
  } catch (error) {
    showToast(errorMessage(error), "error");
    elements.ingestionToken.value = "";
    elements.ingestionToken.focus();
  } finally {
    elements.submitIngestion.disabled = false;
    elements.submitIngestion.textContent = "Archiver dans R2";
  }
}

function sqOptions() {
  const options = {
    service_year: Number(elements.sqYear.value),
    movement_type: elements.sqMovement.value,
  };
  const origin = elements.sqOrigin.value.trim().toUpperCase();
  const destination = elements.sqDestination.value.trim().toUpperCase();
  if (origin) options.origin = origin;
  if (destination) options.destination = destination;
  return options;
}

function invalidateSqPreview() {
  state.sqParse = null;
  elements.submitSq.disabled = true;
  resetSqParse(elements.sqPreview);
}

function resetSqForm() {
  elements.sqToken.value = "";
  elements.sqSource.value = "";
  elements.sqYear.value = "";
  elements.sqOrigin.value = "";
  elements.sqDestination.value = "";
  elements.sqUser.value = "";
  elements.sqSourceName.value = "SQ editing text";
  elements.sqConfirmation.checked = false;
  elements.sqScope.value = "PARTIAL";
  elements.sqMovement.value = "";
  elements.previewSq.disabled = false;
  elements.previewSq.textContent = "Analyser sans écrire";
  elements.submitSq.disabled = true;
  elements.submitSq.textContent = "Importer dans D1";
  invalidateSqPreview();
}

function closeSqDialog() {
  resetSqForm();
  elements.sqDialog.close();
}

function openSqDialog() {
  elements.sqDialog.showModal();
}

function sqPreviewFieldsAreValid() {
  return [
    elements.sqYear,
    elements.sqMovement,
    elements.sqToken,
    elements.sqSource,
  ].every((field) => field.reportValidity());
}

async function previewSq() {
  if (!sqPreviewFieldsAreValid()) return;
  elements.previewSq.disabled = true;
  elements.previewSq.textContent = "Analyse…";
  try {
    const { parse } = await previewSqSource(
      {
        sourceText: elements.sqSource.value,
        options: sqOptions(),
      },
      elements.sqToken.value,
    );
    state.sqParse = parse;
    renderSqParse(elements.sqPreview, parse);
    elements.submitSq.disabled = !parse.can_import;
    showToast(
      parse.can_import
        ? "Source SQ analysée : le modèle est prêt à importer."
        : "Source SQ analysée : une révision est nécessaire.",
      parse.can_import ? "success" : "info",
    );
  } catch (error) {
    showToast(errorMessage(error), "error");
    elements.sqToken.value = "";
    elements.sqToken.focus();
  } finally {
    elements.previewSq.disabled = false;
    elements.previewSq.textContent = "Analyser sans écrire";
  }
}

async function submitSq(event) {
  event.preventDefault();
  if (!elements.sqForm.reportValidity() || !state.sqParse?.can_import) return;
  elements.submitSq.disabled = true;
  elements.submitSq.textContent = "Import SQ en cours…";
  const importId = `IMPORT-SQ-${crypto.randomUUID().toUpperCase()}`;
  try {
    const { result } = await importSqSource(
      {
        sourceText: elements.sqSource.value,
        sourceName: elements.sqSourceName.value.trim(),
        options: sqOptions(),
        context: {
          import_id: importId,
          import_mode: "MANUAL",
          data_scope: elements.sqScope.value,
          user_id: elements.sqUser.value.trim(),
        },
      },
      elements.sqToken.value,
    );
    state.selectedImportId = result.import_id;
    state.selectedFlightId = result.flight?.flight?.flight_id ?? null;
    closeSqDialog();
    showToast(`Import SQ ${result.import_id} : ${result.status}.`, "success");
    await Promise.all([
      loadImports(),
      loadFlightList({ autoSelect: Boolean(state.selectedFlightId) }),
    ]);
  } catch (error) {
    const parsed = error instanceof ApiError ? error.details?.parse : null;
    if (parsed) {
      state.sqParse = parsed;
      renderSqParse(elements.sqPreview, parsed);
    }
    showToast(errorMessage(error), "error");
    elements.sqToken.value = "";
    elements.sqToken.focus();
  } finally {
    elements.submitSq.disabled = !state.sqParse?.can_import;
    elements.submitSq.textContent = "Importer dans D1";
  }
}

function openImportDialog() {
  elements.importId.value = `IMPORT-${crypto.randomUUID().toUpperCase()}`;
  elements.importScope.value = "PARTIAL";
  elements.importDialog.showModal();
}

async function submitImport(event) {
  event.preventDefault();
  if (!elements.importForm.reportValidity()) return;
  let model;
  try {
    model = JSON.parse(elements.importModel.value);
  } catch {
    showToast("Le modèle doit être un objet JSON valide.", "error");
    elements.importModel.focus();
    return;
  }
  const token = elements.importToken.value;
  elements.submitImport.disabled = true;
  elements.submitImport.textContent = "Import en cours…";
  try {
    const { result } = await createStructuredImport(
      {
        model,
        context: {
          import_id: elements.importId.value,
          import_mode: "MANUAL",
          data_scope: elements.importScope.value,
          user_id: elements.importUser.value.trim(),
        },
      },
      token,
    );
    closeImportDialog();
    state.selectedImportId = result.import_id;
    const tone = result.status === "REVIEW_REQUIRED" ? "info" : "success";
    showToast(`Import ${result.import_id} : ${result.status}.`, tone);
    await Promise.all([loadImports(), loadFlightList()]);
  } catch (error) {
    showToast(errorMessage(error), "error");
    elements.importToken.value = "";
    elements.importToken.focus();
  } finally {
    elements.submitImport.disabled = false;
    elements.submitImport.textContent = "Lancer l’import";
  }
}

async function submitFixture(event) {
  event.preventDefault();
  if (!elements.fixtureForm.reportValidity()) {
    return;
  }

  const token = elements.writeToken.value;
  const fixture = createBrowserFixture(elements.fixtureDate.value);
  elements.submitFixture.disabled = true;
  elements.submitFixture.textContent = "Création…";

  try {
    const { flight } = await createFlight(fixture, token);
    state.query = "";
    state.selectedFlightId = flight.flight.flight_id;
    elements.searchInput.value = "";
    elements.clearSearch.classList.add("is-hidden");
    closeFixtureDialog();
    renderFlightDetail(elements.detail, flight);
    updateHash(flight.flight.flight_id);
    showToast(
      `Fixture ${flight.flight.flight_id} créée dans D1.`,
      "success",
    );
    await loadFlightList();
  } catch (error) {
    showToast(errorMessage(error), "error");
    elements.writeToken.value = "";
    elements.writeToken.focus();
  } finally {
    elements.submitFixture.disabled = false;
    elements.submitFixture.textContent = "Créer la fixture D1";
  }
}

elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.query = elements.searchInput.value.trim();
  state.selectedFlightId = null;
  state.offset = 0;
  loadFlightList({ autoSelect: true });
});
elements.loadOps.addEventListener("click", loadOps);

elements.searchInput.addEventListener("input", () => {
  elements.clearSearch.classList.toggle(
    "is-hidden",
    elements.searchInput.value === "",
  );
});

elements.clearSearch.addEventListener("click", () => {
  elements.searchInput.value = "";
  elements.clearSearch.classList.add("is-hidden");
  state.query = "";
  state.selectedFlightId = null;
  state.offset = 0;
  loadFlightList({ autoSelect: true });
  elements.searchInput.focus();
});

elements.list.addEventListener("click", (event) => {
  const item = event.target.closest("[data-flight-id]");
  if (item) {
    selectFlight(item.dataset.flightId);
    if (window.matchMedia("(max-width: 48rem)").matches) {
      elements.detail.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
});

elements.refresh.addEventListener("click", () => loadFlightList());
elements.loadMore.addEventListener("click", () =>
  loadFlightList({ append: true }),
);

elements.openFixture.addEventListener("click", () => {
  elements.fixtureDate.value = new Date().toISOString().slice(0, 10);
  elements.fixtureDialog.showModal();
});
elements.closeFixture.addEventListener("click", closeFixtureDialog);
elements.cancelFixture.addEventListener("click", closeFixtureDialog);
elements.fixtureForm.addEventListener("submit", submitFixture);
elements.fixtureDialog.addEventListener("cancel", () => resetFixtureForm());
elements.refreshImports.addEventListener("click", () => loadImports());
elements.importList.addEventListener("click", (event) => {
  const item = event.target.closest("[data-import-id]");
  if (item) selectImport(item.dataset.importId);
});
elements.importDetail.addEventListener("click", (event) => {
  const button = event.target.closest("[data-issue-id][data-resolution]");
  if (button) decideImportIssue(button.dataset.issueId, button.dataset.resolution);
});
elements.importFilters.addEventListener("submit", (event) => {
  event.preventDefault();
  state.importQuery = elements.importSearch.value.trim();
  state.importStatus = elements.importStatusFilter.value;
  state.importMode = elements.importModeFilter.value;
  state.importOffset = 0;
  state.selectedImportId = null;
  loadImports({ selectLatest: true });
});
elements.resetImportFilters.addEventListener("click", () => {
  elements.importSearch.value = "";
  elements.importStatusFilter.value = "";
  elements.importModeFilter.value = "";
  state.importQuery = "";
  state.importStatus = "";
  state.importMode = "";
  state.importOffset = 0;
  state.selectedImportId = null;
  loadImports({ selectLatest: true });
});
elements.previousImports.addEventListener("click", () => {
  state.importOffset = Math.max(0, state.importOffset - PAGE_SIZE);
  state.selectedImportId = null;
  loadImports({ selectLatest: true });
});
elements.nextImports.addEventListener("click", () => {
  if (!state.importHasMore) return;
  state.importOffset += PAGE_SIZE;
  state.selectedImportId = null;
  loadImports({ selectLatest: true });
});
elements.openImport.addEventListener("click", openImportDialog);
elements.closeImport.addEventListener("click", closeImportDialog);
elements.cancelImport.addEventListener("click", closeImportDialog);
elements.importForm.addEventListener("submit", submitImport);
elements.importDialog.addEventListener("cancel", resetImportForm);
elements.openSq.addEventListener("click", openSqDialog);
elements.closeSq.addEventListener("click", closeSqDialog);
elements.cancelSq.addEventListener("click", closeSqDialog);
elements.previewSq.addEventListener("click", previewSq);
elements.sqForm.addEventListener("submit", submitSq);
elements.sqDialog.addEventListener("cancel", resetSqForm);
elements.openIngestion.addEventListener("click", openIngestionDialog);
elements.closeIngestion.addEventListener("click", closeIngestionDialog);
elements.cancelIngestion.addEventListener("click", closeIngestionDialog);
elements.ingestionForm.addEventListener("submit", submitIngestion);
elements.ingestionDialog.addEventListener("cancel", resetIngestionForm);
elements.loadIngestions.addEventListener("click", () => {
  state.ingestionOffset = 0;
  state.selectedIngestionId = null;
  loadIngestionList({ selectLatest: true });
});
elements.refreshIngestions.addEventListener("click", () => loadIngestionList());
elements.ingestionList.addEventListener("click", (event) => {
  const item = event.target.closest("[data-ingestion-id]");
  if (item) selectIngestion(item.dataset.ingestionId);
});
elements.previousIngestions.addEventListener("click", () => {
  state.ingestionOffset = Math.max(0, state.ingestionOffset - PAGE_SIZE);
  state.selectedIngestionId = null;
  loadIngestionList({ selectLatest: true });
});
elements.nextIngestions.addEventListener("click", () => {
  if (!state.ingestionHasMore) return;
  state.ingestionOffset += PAGE_SIZE;
  state.selectedIngestionId = null;
  loadIngestionList({ selectLatest: true });
});
for (const field of [
  elements.sqYear,
  elements.sqMovement,
  elements.sqOrigin,
  elements.sqDestination,
  elements.sqSource,
]) {
  field.addEventListener("input", invalidateSqPreview);
}

await Promise.all([
  checkHealth(),
  loadFlightList({ autoSelect: true, useHash: true }),
  loadImports(),
]);
