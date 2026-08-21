import {
  ApiError,
  createFlight,
  createStructuredImport,
  getFlight,
  getHealth,
  getImport,
  listFlights,
  listImports,
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
} from "./renderImport.js";

const PAGE_SIZE = 25;

const elements = {
  serviceState: document.querySelector("#service-state"),
  serviceStateLabel: document.querySelector("#service-state-label"),
  apiVersion: document.querySelector("#api-version"),
  visibleCount: document.querySelector("#visible-count"),
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
    return error.message;
  }
  return "Le service est momentanément inaccessible.";
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
    const result = await listImports({ limit: 25 });
    if (requestId !== state.importListRequest) return;
    state.imports = result.imports;
    renderImports();
    const candidate = selectLatest
      ? state.imports[0]?.id
      : state.selectedImportId ?? state.imports[0]?.id;
    if (candidate) await selectImport(candidate);
  } catch (error) {
    if (requestId === state.importListRequest) {
      renderImportError(elements.importList, errorMessage(error));
    }
  } finally {
    if (requestId === state.importListRequest) elements.refreshImports.disabled = false;
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
    const health = await getHealth();
    elements.serviceState.classList.remove("is-loading", "is-offline");
    elements.serviceState.classList.add("is-online");
    elements.serviceStateLabel.textContent = "Service opérationnel";
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
elements.openImport.addEventListener("click", openImportDialog);
elements.closeImport.addEventListener("click", closeImportDialog);
elements.cancelImport.addEventListener("click", closeImportDialog);
elements.importForm.addEventListener("submit", submitImport);
elements.importDialog.addEventListener("cancel", resetImportForm);

await Promise.all([
  checkHealth(),
  loadFlightList({ autoSelect: true, useHash: true }),
  loadImports(),
]);
