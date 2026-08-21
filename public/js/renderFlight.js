import {
  dataValue,
  escapeHtml,
  formatDate,
  formatDateTime,
  joinValues,
  labelFor,
  statusTone,
} from "./formatters.js";

const asArray = (value) => (Array.isArray(value) ? value : []);

function status(value) {
  if (value === undefined || value === null) {
    return dataValue(value, { provided: value !== undefined });
  }
  return `<span class="status-pill ${statusTone(value)}">${escapeHtml(labelFor(value))}</span>`;
}

function detailField(label, value, options = {}) {
  return `
    <div class="data-point">
      <dt>${escapeHtml(label)}</dt>
      <dd>${dataValue(value, options)}</dd>
    </div>`;
}

function sectionHeading(title, count) {
  return `
    <div class="section-heading">
      <h3>${escapeHtml(title)}</h3>
      ${count === undefined ? "" : `<span class="section-count">${escapeHtml(count)}</span>`}
    </div>`;
}

function emptyBlock(message) {
  return `<p class="empty-block">${escapeHtml(message)}</p>`;
}

export function renderFlightList(container, flights, selectedFlightId) {
  if (!Array.isArray(flights) || flights.length === 0) {
    container.innerHTML = `
      <div class="list-message">
        <p>Aucun vol ne correspond à cette recherche.</p>
      </div>`;
    return;
  }

  container.innerHTML = flights
    .map((flight) => {
      const timings = flight.timings ?? {};
      const selected = flight.flight_id === selectedFlightId;
      return `
        <button
          class="flight-list-item${selected ? " is-selected" : ""}"
          type="button"
          data-flight-id="${escapeHtml(flight.flight_id)}"
          aria-pressed="${selected}"
        >
          <span class="flight-list-primary">
            <span class="flight-number">${escapeHtml(flight.airline)} ${escapeHtml(flight.flight_number)}</span>
            <span class="flight-date">${escapeHtml(formatDate(flight.service_date_internal))}</span>
          </span>
          <span class="flight-list-secondary">
            <strong>${escapeHtml(flight.origin)}</strong>
            <span class="route-arrow" aria-hidden="true">→</span>
            <strong>${escapeHtml(flight.destination)}</strong>
            <span>·</span>
            <span>${dataValue(timings.std, {
              provided: Object.hasOwn(timings, "std"),
            })}</span>
          </span>
          <span class="flight-list-meta">
            ${timings.flight_status === undefined ? "" : status(timings.flight_status)}
            ${flight.aircraft?.type ? `<span class="tag">${escapeHtml(flight.aircraft.type)}</span>` : ""}
          </span>
        </button>`;
    })
    .join("");
}

function renderTimings(timings) {
  const fields = [
    ["STD", timings.std, Object.hasOwn(timings, "std")],
    ["ETD", timings.etd, Object.hasOwn(timings, "etd")],
    ["ATD", timings.atd, Object.hasOwn(timings, "atd")],
    ["Embarquement", timings.boarding_time, Object.hasOwn(timings, "boarding_time")],
  ];
  return `
    <section class="detail-section">
      ${sectionHeading("Horaires et statuts")}
      <dl class="data-grid">
        ${fields
          .map(([label, value, provided]) =>
            detailField(label, value, { provided }),
          )
          .join("")}
        <div class="data-point">
          <dt>Statut vol</dt>
          <dd>${status(timings.flight_status)}</dd>
        </div>
        <div class="data-point">
          <dt>Acceptation</dt>
          <dd>${status(timings.acceptance_status)}</dd>
        </div>
        ${detailField("Validé le", timings.status_validated_at, {
          provided: Object.hasOwn(timings, "status_validated_at"),
          transform: formatDateTime,
        })}
        ${detailField("Validé par", timings.status_validated_by, {
          provided: Object.hasOwn(timings, "status_validated_by"),
        })}
      </dl>
    </section>`;
}

function renderAircraft(aircraft) {
  const configuration = asArray(aircraft.cabin_configuration);
  const configurationContent = configuration.length
    ? `<div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Classe</th><th>Capacité fournie</th></tr></thead>
          <tbody>
            ${configuration
              .map(
                (entry) => `
                  <tr>
                    <td><code class="inline-code">${escapeHtml(entry.class)}</code></td>
                    <td>${dataValue(entry.capacity, { provided: Object.hasOwn(entry, "capacity") })}</td>
                  </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`
    : emptyBlock("Configuration cabine non fournie.");

  return `
    <section class="detail-section">
      ${sectionHeading("Appareil et cabine", configuration.length)}
      <dl class="data-grid">
        ${detailField("Type appareil", aircraft.type, {
          provided: Object.hasOwn(aircraft, "type"),
        })}
        ${detailField("Seatmap", aircraft.seatmap_id, {
          provided: Object.hasOwn(aircraft, "seatmap_id"),
        })}
      </dl>
      <div class="section-spaced">${configurationContent}</div>
    </section>`;
}

function loadClasses(load, aircraft) {
  const classes = new Set(
    asArray(aircraft.cabin_configuration).map((entry) => entry.class),
  );
  for (const block of ["booked", "accepted", "availability", "standby"]) {
    for (const entry of asArray(load[block])) {
      classes.add(entry.class);
    }
  }
  return [...classes];
}

function loadValue(load, block, classCode) {
  if (!Object.hasOwn(load, block)) {
    return dataValue(undefined, { provided: false });
  }
  const entry = asArray(load[block]).find((item) => item.class === classCode);
  return entry
    ? dataValue(entry.value, { provided: Object.hasOwn(entry, "value") })
    : dataValue(undefined, { provided: false });
}

function renderLoad(load, aircraft) {
  const classes = loadClasses(load, aircraft);
  const table = classes.length
    ? `<div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Classe</th><th>Réservés</th><th>Acceptés</th>
              <th>Disponibilité</th><th>Standby</th>
            </tr>
          </thead>
          <tbody>
            ${classes
              .map(
                (classCode) => `
                  <tr>
                    <td><code class="inline-code">${escapeHtml(classCode)}</code></td>
                    <td>${loadValue(load, "booked", classCode)}</td>
                    <td>${loadValue(load, "accepted", classCode)}</td>
                    <td>${loadValue(load, "availability", classCode)}</td>
                    <td>${loadValue(load, "standby", classCode)}</td>
                  </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`
    : emptyBlock("Aucune charge par classe fournie.");

  return `
    <section class="detail-section">
      ${sectionHeading("Charge", classes.length)}
      ${table}
      <dl class="data-grid section-spaced">
        ${detailField("Bébés réservés", load.booked_infants, {
          provided: Object.hasOwn(load, "booked_infants"),
        })}
        ${detailField("Bébés acceptés", load.accepted_infants, {
          provided: Object.hasOwn(load, "accepted_infants"),
        })}
      </dl>
    </section>`;
}

function renderPassengers(passengers) {
  if (passengers.length === 0) {
    return emptyBlock("Aucun passager fourni pour ce vol.");
  }
  return `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Passager</th><th>Type</th><th>Cabine</th><th>Classe résa</th>
            <th>Siège</th><th>Parent</th><th>Codes</th><th>Documents</th>
          </tr>
        </thead>
        <tbody>
          ${passengers
            .map((passenger) => {
              const codes = asArray(passenger.codes).map(
                (code) => `${code.category}:${code.code}`,
              );
              const documents = [
                ...asArray(passenger.etkt),
                ...asArray(passenger.emds).map((emd) => emd.number),
              ];
              return `
                <tr>
                  <td>
                    <strong>${dataValue(passenger.passenger_name_raw, {
                      provided: Object.hasOwn(passenger, "passenger_name_raw"),
                    })}</strong>
                    ${passenger.remark ? `<br><span class="value-absent">${escapeHtml(passenger.remark)}</span>` : ""}
                  </td>
                  <td>${escapeHtml(labelFor(passenger.passenger_type))}</td>
                  <td>${dataValue(passenger.cabin_class, { provided: Object.hasOwn(passenger, "cabin_class") })}</td>
                  <td>${dataValue(passenger.booking_class, { provided: Object.hasOwn(passenger, "booking_class") })}</td>
                  <td>${dataValue(passenger.seat, { provided: Object.hasOwn(passenger, "seat") })}</td>
                  <td>${dataValue(passenger.parent_passenger_id, { provided: Object.hasOwn(passenger, "parent_passenger_id") })}</td>
                  <td>${joinValues(codes, ", ")}</td>
                  <td>${joinValues(documents, ", ")}</td>
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function renderParticularities(particularities) {
  if (particularities.length === 0) {
    return emptyBlock("Aucune particularité fournie.");
  }
  return `<div class="stack-list">
    ${particularities
      .map(
        (item) => `
          <article class="record-card">
            <div class="meta-row">
              <strong>${escapeHtml(item.category)}</strong>
              <span class="tag">PAX ${dataValue(item.pax_count, {
                provided: Object.hasOwn(item, "pax_count"),
              })}</span>
            </div>
            <div class="code-list">
              ${asArray(item.codes)
                .map(
                  (code) =>
                    `<code>${escapeHtml(code.code)} · ${dataValue(code.count, {
                      provided: Object.hasOwn(code, "count"),
                    })}</code>`,
                )
                .join("")}
            </div>
            <p>Passagers identifiés : ${joinValues(item.passenger_ids, ", ")}</p>
          </article>`,
      )
      .join("")}
  </div>`;
}

function renderInbound(connections) {
  if (connections.length === 0) {
    return emptyBlock("Aucune connexion entrante fournie.");
  }
  return `<div class="stack-list">
    ${connections
      .map(
        (item) => `
          <article class="record-card">
            <div class="meta-row">
              <strong>${escapeHtml(item.inbound_flight)}</strong>
              <span class="tag">${escapeHtml(item.origin)} → ${escapeHtml(item.destination)}</span>
            </div>
            <p>
              Arrivée ${dataValue(item.arrival_time, { provided: Object.hasOwn(item, "arrival_time") })}
              · Connexion ${dataValue(item.connection_time, { provided: Object.hasOwn(item, "connection_time") })}
              · Total ${dataValue(item.pax_count, { provided: Object.hasOwn(item, "pax_count") })}
              · Identifiés ${dataValue(item.identified_pax_count, { provided: Object.hasOwn(item, "identified_pax_count") })}
            </p>
            ${item.remark ? `<p>${escapeHtml(item.remark)}</p>` : ""}
          </article>`,
      )
      .join("")}
  </div>`;
}

function renderOutbound(connections) {
  if (connections.length === 0) {
    return emptyBlock("Aucune connexion sortante fournie.");
  }
  return `<div class="stack-list">
    ${connections
      .map(
        (item) => `
          <article class="record-card">
            <div class="meta-row">
              <strong>${escapeHtml(item.outbound_flight)}</strong>
              <span class="tag">${escapeHtml(item.origin)} → ${escapeHtml(item.destination)}</span>
            </div>
            <p>
              STD ${dataValue(item.std, { provided: Object.hasOwn(item, "std") })}
              · Connexion ${dataValue(item.connection_time, { provided: Object.hasOwn(item, "connection_time") })}
              · Total ${dataValue(item.total_pax, { provided: Object.hasOwn(item, "total_pax") })}
              · Identifiés ${dataValue(item.identified_pax_count, { provided: Object.hasOwn(item, "identified_pax_count") })}
            </p>
            <div class="code-list">
              ${asArray(item.booked)
                .map(
                  (entry) =>
                    `<code>${escapeHtml(entry.class)} · ${dataValue(entry.pax, { provided: Object.hasOwn(entry, "pax") })} PAX</code>`,
                )
                .join("")}
            </div>
            <p>
              Destination finale ${dataValue(item.final_destination, { provided: Object.hasOwn(item, "final_destination") })}
              · Terminal ${dataValue(item.terminal, { provided: Object.hasOwn(item, "terminal") })}
              · Porte ${dataValue(item.gate, { provided: Object.hasOwn(item, "gate") })}
            </p>
            ${item.remark ? `<p>${escapeHtml(item.remark)}</p>` : ""}
          </article>`,
      )
      .join("")}
  </div>`;
}

function renderGroups(groups) {
  const items = asArray(groups.items);
  const summary = groups.summary ?? {};
  return `
    <dl class="data-grid">
      ${detailField("Nombre de groupes", summary.group_count, {
        provided: Object.hasOwn(summary, "group_count"),
      })}
      ${detailField("Total passagers groupe", summary.total_group_pax, {
        provided: Object.hasOwn(summary, "total_group_pax"),
      })}
    </dl>
    <div class="stack-list section-spaced">
      ${
        items.length
          ? items
              .map(
                (item) => `
                  <article class="record-card">
                    <div class="meta-row">
                      <strong>${dataValue(item.group_name, { provided: Object.hasOwn(item, "group_name") })}</strong>
                      <span class="tag">${dataValue(item.pax_count, { provided: Object.hasOwn(item, "pax_count") })} PAX</span>
                    </div>
                    <p>
                      Cabine ${dataValue(item.cabin_class, { provided: Object.hasOwn(item, "cabin_class") })}
                      · PNR ${dataValue(item.pnr, { provided: Object.hasOwn(item, "pnr") })}
                    </p>
                    ${item.remark ? `<p>${escapeHtml(item.remark)}</p>` : ""}
                  </article>`,
              )
              .join("")
          : emptyBlock("Aucun groupe détaillé fourni.")
      }
    </div>`;
}

function renderDocuments(documents) {
  const tickets = asArray(documents.etkt);
  const emds = asArray(documents.emds);
  const unclassified = asArray(documents.unclassified);
  const items = [
    ...tickets.map((item) => ({
      type: "ETKT",
      value: item.number,
      passenger: item.passenger_id,
      detail: "Explicitement identifié ETKT",
    })),
    ...emds.map((item) => ({
      type: "EMD",
      value: item.number,
      passenger: item.passenger_id,
      detail: [item.associated_code, item.remark].filter(Boolean).join(" · "),
    })),
    ...unclassified.map((item) => ({
      type: "NON CLASSÉ",
      value: item.document_value,
      passenger: item.passenger_id,
      detail: item.document_hint,
    })),
  ];
  if (items.length === 0) {
    return emptyBlock("Aucun document fourni.");
  }
  return `<div class="stack-list">
    ${items
      .map(
        (item) => `
          <article class="record-card">
            <div class="meta-row">
              <strong>${escapeHtml(item.value)}</strong>
              <span class="tag">${escapeHtml(item.type)}</span>
            </div>
            <p>Passager : ${dataValue(item.passenger, { provided: item.passenger !== undefined })}</p>
            ${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ""}
          </article>`,
      )
      .join("")}
  </div>`;
}

export function renderFlightDetail(container, model) {
  const flight = model.flight ?? {};
  const timings = model.timings ?? {};
  const aircraft = model.aircraft ?? {};
  const load = model.load ?? {};
  const passengers = asArray(model.passengers);
  const particularities = asArray(model.particularities);
  const inbounds = asArray(model.inbound);
  const outbounds = asArray(model.outbound_connections);
  const classComments = asArray(model.class_comments);
  const groups = model.groups ?? { summary: {}, items: [] };
  const documents = model.tickets_documents ?? {};

  container.innerHTML = `
    <article>
      <header class="detail-hero">
        <div class="detail-hero-top">
          <div>
            <p class="eyebrow">${escapeHtml(labelFor(flight.movement_type))} · ${escapeHtml(formatDate(flight.service_date_internal))}</p>
            <h2 class="detail-flight-number" id="detail-title">${escapeHtml(flight.airline)} ${escapeHtml(flight.flight_number)}</h2>
            <div class="route-line">
              <span>${escapeHtml(flight.origin)}</span>
              <span class="route-arrow" aria-hidden="true">→</span>
              <span>${escapeHtml(flight.destination)}</span>
            </div>
          </div>
          <div>${status(timings.flight_status)}</div>
        </div>
        <code class="canonical-id">${escapeHtml(flight.flight_id)}</code>
      </header>

      ${renderTimings(timings)}
      <div class="two-columns">
        ${renderAircraft(aircraft)}
        ${renderLoad(load, aircraft)}
      </div>

      <section class="detail-section">
        ${sectionHeading("Passagers", passengers.length)}
        ${renderPassengers(passengers)}
      </section>

      <div class="two-columns">
        <section class="detail-section">
          ${sectionHeading("Particularités", particularities.length)}
          ${renderParticularities(particularities)}
        </section>
        <section class="detail-section">
          ${sectionHeading(
            "Documents",
            asArray(documents.etkt).length +
              asArray(documents.emds).length +
              asArray(documents.unclassified).length,
          )}
          ${renderDocuments(documents)}
        </section>
      </div>

      <div class="two-columns">
        <section class="detail-section">
          ${sectionHeading("Connexions entrantes", inbounds.length)}
          ${renderInbound(inbounds)}
        </section>
        <section class="detail-section">
          ${sectionHeading("Connexions sortantes", outbounds.length)}
          ${renderOutbound(outbounds)}
        </section>
      </div>

      <div class="two-columns">
        <section class="detail-section">
          ${sectionHeading("Groupes", asArray(groups.items).length)}
          ${renderGroups(groups)}
        </section>
        <section class="detail-section">
          ${sectionHeading("Commentaires classe", classComments.length)}
          ${
            classComments.length
              ? `<div class="stack-list">${classComments
                  .map(
                    (item) => `
                      <article class="record-card">
                        <div class="meta-row">
                          <strong>Classe ${escapeHtml(item.class)}</strong>
                        </div>
                        <p>${escapeHtml(item.comment)}</p>
                      </article>`,
                  )
                  .join("")}</div>`
              : emptyBlock("Aucun commentaire classe fourni.")
          }
        </section>
      </div>
    </article>`;
}

export function renderDetailError(container, message) {
  container.innerHTML = `
    <div class="empty-state">
      <span class="empty-icon" aria-hidden="true">!</span>
      <p class="eyebrow">FICHE INDISPONIBLE</p>
      <h2 id="detail-title">Impossible d’afficher ce vol</h2>
      <p>${escapeHtml(message)}</p>
    </div>`;
}
