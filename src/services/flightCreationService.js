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
import { createFlightQueryService } from "./flightQueryService.js";
import { normalizeFlightCreationInput } from "./flightValidation.js";
import { ConflictError } from "./serviceErrors.js";

const LOAD_TYPE_BY_FIELD = Object.freeze({
  booked: "BOOKED",
  accepted: "ACCEPTED",
  availability: "AVAILABILITY",
  standby: "STANDBY",
});

const LOAD_METRIC_BY_FIELD = Object.freeze({
  booked_infants: "BOOKED_INFANTS",
  accepted_infants: "ACCEPTED_INFANTS",
});

function ownFields(source, fields) {
  return Object.fromEntries(
    fields
      .filter((field) => Object.hasOwn(source, field))
      .map((field) => [field, source[field]]),
  );
}

function lastRowId(result, entityName) {
  const value = result?.meta?.last_row_id;
  const numeric = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new Error(`D1 did not return an id for ${entityName}`);
  }
  return numeric;
}

function resolvePassengerId(reference, passengerIdsByReference, field, { nullable = false } = {}) {
  if (nullable && (reference === undefined || reference === null)) {
    return null;
  }
  const passengerId = passengerIdsByReference.get(reference);
  if (!passengerId) {
    throw new Error(`${field} references an unavailable passenger`);
  }
  return passengerId;
}

function isUniqueConstraintError(error) {
  return /UNIQUE constraint failed|constraint failed.*UNIQUE/iu.test(
    error instanceof Error ? error.message : String(error),
  );
}

async function persistFlightRecord(repositories, model) {
  const { flight } = model;
  await repositories.flight.create({
    flight_id: flight.flight_id,
    airline: flight.airline,
    flight_number: flight.flight_number,
    ...(Object.hasOwn(flight, "service_date_raw")
      ? { service_date_raw: flight.service_date_raw }
      : {}),
    service_date_internal: flight.service_date_internal,
    origin: flight.origin,
    destination: flight.destination,
    movement_type: flight.movement_type,
  });
}

async function persistCoreDetails(repositories, model) {
  const { flight, timings, aircraft, load } = model;
  if (Object.keys(timings).length > 0) {
    await repositories.timing.upsert(flight.flight_id, timings);
  }

  const aircraftFields = ownFields(aircraft, ["type", "seatmap_id"]);
  if (Object.keys(aircraftFields).length > 0) {
    await repositories.aircraft.upsertAircraft(flight.flight_id, aircraftFields);
  }
  if (Object.hasOwn(aircraft, "cabin_configuration")) {
    await repositories.aircraft.replaceCabinConfiguration(
      flight.flight_id,
      aircraft.cabin_configuration,
    );
  }

  for (const [field, loadType] of Object.entries(LOAD_TYPE_BY_FIELD)) {
    for (const entry of load[field] ?? []) {
      await repositories.load.upsertClassValue(
        flight.flight_id,
        loadType,
        entry.class,
        entry.value,
      );
    }
  }
  for (const [field, metric] of Object.entries(LOAD_METRIC_BY_FIELD)) {
    if (Object.hasOwn(load, field)) {
      await repositories.load.upsertTotal(flight.flight_id, metric, load[field]);
    }
  }
}

async function persistPassengers(repositories, model) {
  const passengerIdsByReference = new Map();
  const passengerIdsByIndex = [];
  const fields = [
    "passenger_name_raw",
    "passenger_name_normalized",
    "passenger_type",
    "cabin_class",
    "booking_class",
    "seat",
    "remark",
  ];

  for (const [index, passenger] of model.passengers.entries()) {
    const result = await repositories.passenger.create(
      model.flight.flight_id,
      ownFields(passenger, fields),
    );
    const passengerId = lastRowId(result, `passengers[${index}]`);
    passengerIdsByIndex.push(passengerId);
    if (passenger.temp_id !== undefined) {
      passengerIdsByReference.set(passenger.temp_id, passengerId);
    }
  }

  for (const [index, passenger] of model.passengers.entries()) {
    if (passenger.parent_ref !== undefined) {
      const parentId = resolvePassengerId(
        passenger.parent_ref,
        passengerIdsByReference,
        `passengers[${index}].parent_ref`,
      );
      await repositories.passenger.updateField(
        passengerIdsByIndex[index],
        "parent_passenger_id",
        parentId,
      );
    }
  }
  return passengerIdsByReference;
}

async function persistParticularities(
  repositories,
  model,
  passengerIdsByReference,
) {
  for (const item of model.particularities) {
    for (const code of item.codes) {
      const count = Object.hasOwn(code, "count")
        ? code.count
        : Object.hasOwn(item, "pax_count")
          ? item.pax_count
          : null;
      await repositories.particularity.upsertFlightCount(
        model.flight.flight_id,
        item.category,
        code.code,
        count,
      );
      for (const passengerReference of item.passenger_ids) {
        const passengerId = resolvePassengerId(
          passengerReference,
          passengerIdsByReference,
          "particularities.passenger_ids",
        );
        await repositories.particularity.addPassengerParticularity(
          passengerId,
          item.category,
          code.code,
        );
      }
    }
  }
}

async function persistDocuments(
  repositories,
  model,
  passengerIdsByReference,
) {
  const flightId = model.flight.flight_id;
  for (const ticket of model.tickets_documents.etkt) {
    await repositories.documents.addTicket(flightId, {
      passenger_id: resolvePassengerId(
        ticket.passenger_id,
        passengerIdsByReference,
        "tickets_documents.etkt.passenger_id",
      ),
      etkt_number: ticket.number,
    });
  }
  for (const emd of model.tickets_documents.emds) {
    await repositories.documents.addEmd(flightId, {
      passenger_id: resolvePassengerId(
        emd.passenger_id,
        passengerIdsByReference,
        "tickets_documents.emds.passenger_id",
      ),
      emd_number: emd.number,
      associated_code: emd.associated_code,
      remark: emd.remark,
    });
  }
  for (const document of model.tickets_documents.unclassified) {
    await repositories.documents.addUnclassifiedDocument(flightId, {
      passenger_id: resolvePassengerId(
        document.passenger_id,
        passengerIdsByReference,
        "tickets_documents.unclassified.passenger_id",
        { nullable: true },
      ),
      document_value: document.document_value,
      document_hint: document.document_hint,
    });
  }
}

async function persistConnections(
  repositories,
  model,
  passengerIdsByReference,
) {
  const inboundFields = [
    "inbound_flight",
    "origin",
    "destination",
    "arrival_time",
    "connection_time",
    "pax_count",
    "remark",
  ];
  for (const [index, inbound] of model.inbound.entries()) {
    const result = await repositories.connection.addInbound(
      model.flight.flight_id,
      ownFields(inbound, inboundFields),
    );
    const inboundId = lastRowId(result, `inbound[${index}]`);
    for (const passengerReference of inbound.passenger_ids) {
      await repositories.connection.linkPassengerToInbound(
        resolvePassengerId(
          passengerReference,
          passengerIdsByReference,
          `inbound[${index}].passenger_ids`,
        ),
        inboundId,
      );
    }
  }

  const outboundFields = [
    "outbound_flight",
    "origin",
    "destination",
    "std",
    "connection_time",
    "total_pax",
    "final_destination",
    "terminal",
    "gate",
    "remark",
  ];
  for (const [index, outbound] of model.outbound_connections.entries()) {
    const result = await repositories.connection.addOutbound(
      model.flight.flight_id,
      ownFields(outbound, outboundFields),
    );
    const outboundId = lastRowId(result, `outbound_connections[${index}]`);
    for (const load of outbound.booked) {
      await repositories.connection.upsertOutboundLoad(
        outboundId,
        load.class,
        load.pax,
      );
    }
    for (const passengerReference of outbound.passenger_ids) {
      await repositories.connection.linkPassengerToOutbound(
        resolvePassengerId(
          passengerReference,
          passengerIdsByReference,
          `outbound_connections[${index}].passenger_ids`,
        ),
        outboundId,
      );
    }
  }
}

async function persistGroupsAndComments(repositories, model) {
  if (Object.keys(model.groups.summary).length > 0) {
    await repositories.group.upsertSummary(
      model.flight.flight_id,
      model.groups.summary,
    );
  }
  for (const group of model.groups.items) {
    await repositories.group.addGroup(
      model.flight.flight_id,
      ownFields(group, [
        "group_name",
        "pax_count",
        "cabin_class",
        "pnr",
        "remark",
      ]),
    );
  }
  for (const comment of model.class_comments) {
    await repositories.classComment.add(model.flight.flight_id, comment);
  }
}

function createRepositories(db) {
  return {
    flight: createFlightRepository(db),
    timing: createTimingRepository(db),
    aircraft: createAircraftRepository(db),
    load: createLoadRepository(db),
    passenger: createPassengerRepository(db),
    particularity: createParticularityRepository(db),
    documents: createTicketDocumentRepository(db),
    connection: createConnectionRepository(db),
    group: createGroupRepository(db),
    classComment: createClassCommentRepository(db),
  };
}

export function createFlightCreationService(db) {
  const repositories = createRepositories(db);
  const queryService = createFlightQueryService(db);

  return {
    async create(input) {
      const model = normalizeFlightCreationInput(input);
      const flightId = model.flight.flight_id;
      if (await repositories.flight.findById(flightId)) {
        throw new ConflictError(`Flight ${flightId} already exists`, {
          flight_id: flightId,
        });
      }

      let flightCreated = false;
      try {
        await persistFlightRecord(repositories, model);
        flightCreated = true;
        await persistCoreDetails(repositories, model);
        const passengerIdsByReference = await persistPassengers(
          repositories,
          model,
        );
        await persistParticularities(
          repositories,
          model,
          passengerIdsByReference,
        );
        await persistDocuments(repositories, model, passengerIdsByReference);
        await persistConnections(repositories, model, passengerIdsByReference);
        await persistGroupsAndComments(repositories, model);
      } catch (error) {
        if (flightCreated) {
          try {
            await repositories.flight.remove(flightId);
          } catch (cleanupError) {
            console.error(
              JSON.stringify({
                message: "flight creation cleanup failed",
                flight_id: flightId,
                error:
                  cleanupError instanceof Error
                    ? cleanupError.message
                    : String(cleanupError),
              }),
            );
          }
        }
        if (isUniqueConstraintError(error)) {
          throw new ConflictError(`Flight data conflicts with existing records`, {
            flight_id: flightId,
          });
        }
        throw error;
      }

      return queryService.findById(flightId);
    },
  };
}
