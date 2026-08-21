import { createAircraftRepository } from "../database/aircraftRepository.js";
import { createClassCommentRepository } from "../database/classCommentRepository.js";
import { createConnectionRepository } from "../database/connectionRepository.js";
import { createFlightRepository } from "../database/flightRepository.js";
import { createGroupRepository } from "../database/groupRepository.js";
import { createLoadRepository } from "../database/loadRepository.js";
import { createParticularityRepository } from "../database/particularityRepository.js";
import { createPassengerRepository } from "../database/passengerRepository.js";
import { createTicketDocumentRepository } from "../database/ticketDocumentRepository.js";
import { createTimingRepository } from "../database/timingRepository.js";
import { createFlightImportModel } from "../models/flightImportModel.js";

const LOAD_FIELD_BY_TYPE = Object.freeze({
  BOOKED: "booked",
  ACCEPTED: "accepted",
  AVAILABILITY: "availability",
  STANDBY: "standby",
});

const LOAD_FIELD_BY_METRIC = Object.freeze({
  BOOKED_INFANTS: "booked_infants",
  ACCEPTED_INFANTS: "accepted_infants",
});

function flightFromRow(row) {
  return {
    airline: row.airline,
    flight_number: row.flight_number,
    service_date_raw: row.service_date_raw,
    service_date_internal: row.service_date_internal,
    origin: row.origin,
    destination: row.destination,
    movement_type: row.movement_type,
    flight_id: row.id,
  };
}

function timingsFromRow(row) {
  if (!row) {
    return {};
  }
  return Object.fromEntries(
    [
      "std",
      "etd",
      "atd",
      "boarding_time",
      "flight_status",
      "acceptance_status",
      "status_validated_at",
      "status_validated_by",
    ]
      .filter((field) => row[field] !== undefined)
      .map((field) => [field, row[field]]),
  );
}

function aircraftFromRows(aircraft, cabinConfiguration) {
  const model = {};
  if (aircraft) {
    model.type = aircraft.aircraft_type;
    model.seatmap_id = aircraft.seatmap_id;
  }
  if (cabinConfiguration.length > 0) {
    model.cabin_configuration = cabinConfiguration.map((entry) => ({
      class: entry.class_code,
      capacity: entry.capacity,
    }));
  }
  return model;
}

function loadFromRows(classValues, totals) {
  const model = {};
  for (const row of classValues) {
    const field = LOAD_FIELD_BY_TYPE[row.load_type];
    if (!field) {
      continue;
    }
    model[field] ??= [];
    model[field].push({ class: row.class_code, value: row.value });
  }
  for (const row of totals) {
    const field = LOAD_FIELD_BY_METRIC[row.metric];
    if (field) {
      model[field] = row.value;
    }
  }
  return model;
}

function groupBy(rows, field) {
  const grouped = new Map();
  for (const row of rows) {
    const key = row[field];
    const entries = grouped.get(key) ?? [];
    entries.push(row);
    grouped.set(key, entries);
  }
  return grouped;
}

function passengersFromRows({ passengers, passengerParticularities, tickets, emds }) {
  const particularitiesByPassenger = groupBy(
    passengerParticularities,
    "passenger_id",
  );
  const ticketsByPassenger = groupBy(tickets, "passenger_id");
  const emdsByPassenger = groupBy(emds, "passenger_id");

  return passengers.map((row) => ({
    id: row.id,
    passenger_name_raw: row.passenger_name_raw,
    passenger_name_normalized: row.passenger_name_normalized,
    passenger_type: row.passenger_type,
    parent_passenger_id: row.parent_passenger_id,
    cabin_class: row.cabin_class,
    booking_class: row.booking_class,
    seat: row.seat,
    remark: row.remark,
    etkt: (ticketsByPassenger.get(row.id) ?? []).map(
      (ticket) => ticket.etkt_number,
    ),
    emds: (emdsByPassenger.get(row.id) ?? []).map((emd) => ({
      number: emd.emd_number,
      associated_code: emd.associated_code,
      remark: emd.remark,
    })),
    codes: (particularitiesByPassenger.get(row.id) ?? []).map((item) => ({
      category: item.category,
      code: item.code,
    })),
    connection_refs: [],
  }));
}

function particularitiesFromRows(countRows, passengerRows) {
  const grouped = new Map();
  for (const row of [...countRows, ...passengerRows]) {
    const model = grouped.get(row.category) ?? {
      category: row.category,
      codes: new Map(),
      passenger_ids: new Set(),
    };
    const code = model.codes.get(row.code) ?? { code: row.code };
    if (Object.hasOwn(row, "pax_count")) {
      code.count = row.pax_count;
    }
    model.codes.set(row.code, code);
    if (row.passenger_id !== undefined) {
      model.passenger_ids.add(row.passenger_id);
    }
    grouped.set(row.category, model);
  }

  return [...grouped.values()].map((item) => {
    const codes = [...item.codes.values()];
    const model = {
      category: item.category,
      codes,
      passenger_ids: [...item.passenger_ids],
    };
    if (codes.length === 1 && Object.hasOwn(codes[0], "count")) {
      model.pax_count = codes[0].count;
    }
    return model;
  });
}

function ticketsDocumentsFromRows(tickets, emds, unclassified) {
  return {
    etkt: tickets.map((row) => ({
      number: row.etkt_number,
      passenger_id: row.passenger_id,
    })),
    emds: emds.map((row) => ({
      number: row.emd_number,
      passenger_id: row.passenger_id,
      associated_code: row.associated_code,
      remark: row.remark,
    })),
    unclassified: unclassified.map((row) => ({
      document_value: row.document_value,
      document_hint: row.document_hint,
      passenger_id: row.passenger_id,
    })),
  };
}

function passengerIdsForConnection(connections, type, connectionId) {
  const idField = type === "INBOUND" ? "inbound_id" : "outbound_id";
  return connections
    .filter(
      (row) => row.connection_type === type && row[idField] === connectionId,
    )
    .map((row) => row.passenger_id);
}

function inboundsFromRows(inbounds, passengerConnections) {
  return inbounds.map((row) => {
    const passengerIds = passengerIdsForConnection(
      passengerConnections,
      "INBOUND",
      row.id,
    );
    return {
      id: row.id,
      inbound_flight: row.inbound_flight,
      origin: row.origin,
      destination: row.destination,
      arrival_time: row.arrival_time,
      connection_time: row.connection_time,
      pax_count: row.pax_count,
      identified_pax_count: passengerIds.length,
      passenger_ids: passengerIds,
      remark: row.remark,
    };
  });
}

function outboundsFromRows(outbounds, outboundLoads, passengerConnections) {
  const loadsByConnection = groupBy(outboundLoads, "outbound_connection_id");
  return outbounds.map((row) => {
    const passengerIds = passengerIdsForConnection(
      passengerConnections,
      "OUTBOUND",
      row.id,
    );
    return {
      id: row.id,
      outbound_flight: row.outbound_flight,
      origin: row.origin,
      destination: row.destination,
      std: row.std,
      connection_time: row.connection_time,
      booked: (loadsByConnection.get(row.id) ?? []).map((load) => ({
        class: load.class_code,
        pax: load.pax_count,
      })),
      total_pax: row.total_pax,
      identified_pax_count: passengerIds.length,
      passenger_ids: passengerIds,
      final_destination: row.final_destination,
      terminal: row.terminal,
      gate: row.gate,
      remark: row.remark,
    };
  });
}

function groupsFromRows(summary, items) {
  return {
    summary: summary
      ? {
          group_count: summary.group_count,
          total_group_pax: summary.total_group_pax,
        }
      : {},
    items: items.map((row) => ({
      id: row.id,
      group_name: row.group_name,
      pax_count: row.pax_count,
      cabin_class: row.cabin_class,
      pnr: row.pnr,
      remark: row.remark,
    })),
  };
}

function classCommentsFromRows(rows) {
  return rows.map((row) => ({
    class: row.class_code,
    comment: row.comment_text,
  }));
}

function listSummaryFromRow(row) {
  return {
    ...flightFromRow(row),
    timings: row.timing_id === null || row.timing_id === undefined
      ? {}
      : timingsFromRow(row),
    aircraft: row.aircraft_id === null || row.aircraft_id === undefined
      ? {}
      : { type: row.aircraft_type },
  };
}

export function createFlightQueryService(db) {
  const flightRepository = createFlightRepository(db);
  const timingRepository = createTimingRepository(db);
  const aircraftRepository = createAircraftRepository(db);
  const loadRepository = createLoadRepository(db);
  const passengerRepository = createPassengerRepository(db);
  const particularityRepository = createParticularityRepository(db);
  const ticketDocumentRepository = createTicketDocumentRepository(db);
  const connectionRepository = createConnectionRepository(db);
  const groupRepository = createGroupRepository(db);
  const classCommentRepository = createClassCommentRepository(db);

  return {
    async list({ query = "", limit = 25, offset = 0 } = {}) {
      const rows = await flightRepository.list({
        query,
        limit: limit + 1,
        offset,
      });
      return {
        flights: rows.slice(0, limit).map(listSummaryFromRow),
        pagination: {
          limit,
          offset,
          has_more: rows.length > limit,
        },
      };
    },

    async findById(flightId) {
      const flight = await flightRepository.findById(flightId);
      if (!flight) {
        return null;
      }

      const [
        timings,
        aircraft,
        cabinConfiguration,
        load,
        loadTotals,
        passengers,
        passengerParticularities,
        particularityCounts,
        tickets,
        emds,
        unclassified,
        inbounds,
        outbounds,
        outboundLoads,
        passengerConnections,
        groupSummary,
        groups,
        classComments,
      ] = await Promise.all([
        timingRepository.findByFlightId(flightId),
        aircraftRepository.findByFlightId(flightId),
        aircraftRepository.getCabinConfiguration(flightId),
        loadRepository.getByFlightId(flightId),
        loadRepository.getTotalsByFlightId(flightId),
        passengerRepository.getByFlightId(flightId),
        particularityRepository.getPassengerParticularitiesByFlightId(flightId),
        particularityRepository.getFlightParticularityCounts(flightId),
        ticketDocumentRepository.getTicketsByFlightId(flightId),
        ticketDocumentRepository.getEmdsByFlightId(flightId),
        ticketDocumentRepository.getUnclassifiedByFlightId(flightId),
        connectionRepository.getInboundsByFlightId(flightId),
        connectionRepository.getOutboundsByFlightId(flightId),
        connectionRepository.getOutboundLoadsByFlightId(flightId),
        connectionRepository.getPassengerConnectionsByFlightId(flightId),
        groupRepository.getSummary(flightId),
        groupRepository.getGroupsByFlightId(flightId),
        classCommentRepository.getByFlightId(flightId),
      ]);

      return createFlightImportModel({
        flight: flightFromRow(flight),
        timings: timingsFromRow(timings),
        aircraft: aircraftFromRows(aircraft, cabinConfiguration),
        load: loadFromRows(load, loadTotals),
        passengers: passengersFromRows({
          passengers,
          passengerParticularities,
          tickets,
          emds,
        }),
        particularities: particularitiesFromRows(
          particularityCounts,
          passengerParticularities,
        ),
        tickets_documents: ticketsDocumentsFromRows(
          tickets,
          emds,
          unclassified,
        ),
        inbound: inboundsFromRows(inbounds, passengerConnections),
        outbound_connections: outboundsFromRows(
          outbounds,
          outboundLoads,
          passengerConnections,
        ),
        groups: groupsFromRows(groupSummary, groups),
        class_comments: classCommentsFromRows(classComments),
        airline_extensions: {},
        import: {},
        issues: [],
      });
    },
  };
}
