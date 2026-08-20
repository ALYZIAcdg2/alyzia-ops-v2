import { createAircraftModel } from "./aircraftModel.js";
import {
  createInboundModel,
  createOutboundConnectionModel,
} from "./connectionModel.js";
import { createFlightModel } from "./flightModel.js";
import { createGroupModel } from "./groupModel.js";
import { createImportModel } from "./importModel.js";
import { createLoadModel } from "./loadModel.js";
import { cloneValue, copyArray, copyOwnFields } from "./modelUtils.js";
import { createParticularityModel } from "./particularityModel.js";
import { createPassengerModel } from "./passengerModel.js";
import { createTicketDocumentModel } from "./ticketDocumentModel.js";
import { createTimingModel } from "./timingModel.js";

function createClassComment(input) {
  const comment = copyOwnFields(input, ["class", "comment"]);

  if (
    Object.hasOwn(comment, "comment") &&
    (typeof comment.comment !== "string" || comment.comment.trim() === "")
  ) {
    throw new TypeError("class_comments cannot contain an empty comment");
  }

  return comment;
}

function createAirlineExtensions(input) {
  if (input === undefined) {
    return {};
  }

  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("airline_extensions must be an object");
  }

  return cloneValue(input);
}

export class FlightImportModel {
  constructor(input = {}) {
    this.flight = createFlightModel(input.flight ?? {});
    this.timings = createTimingModel(input.timings ?? {});
    this.aircraft = createAircraftModel(input.aircraft ?? {});
    this.load = createLoadModel(input.load ?? {});
    this.passengers = copyArray(
      input.passengers ?? [],
      "passengers",
    ).map(createPassengerModel);
    this.particularities = copyArray(
      input.particularities ?? [],
      "particularities",
    ).map(createParticularityModel);
    this.tickets_documents = createTicketDocumentModel(
      input.tickets_documents ?? {},
    );
    this.inbound = copyArray(input.inbound ?? [], "inbound").map(
      createInboundModel,
    );
    this.outbound_connections = copyArray(
      input.outbound_connections ?? [],
      "outbound_connections",
    ).map(createOutboundConnectionModel);
    this.groups = createGroupModel(input.groups ?? {});
    this.class_comments = copyArray(
      input.class_comments ?? [],
      "class_comments",
    ).map(createClassComment);
    this.airline_extensions = createAirlineExtensions(
      input.airline_extensions,
    );
    this.import = createImportModel(input.import ?? {});
    this.issues = copyArray(input.issues ?? [], "issues");
  }
}

export function createFlightImportModel(input = {}) {
  return new FlightImportModel(input);
}

export default FlightImportModel;
