import { copyArray, copyOwnFields } from "./modelUtils.js";

const INBOUND_FIELDS = Object.freeze([
  "id",
  "inbound_flight",
  "origin",
  "destination",
  "arrival_time",
  "connection_time",
  "pax_count",
  "identified_pax_count",
  "remark",
]);

const OUTBOUND_FIELDS = Object.freeze([
  "id",
  "outbound_flight",
  "origin",
  "destination",
  "std",
  "connection_time",
  "total_pax",
  "identified_pax_count",
  "final_destination",
  "terminal",
  "gate",
  "remark",
]);

export function createInboundModel(input = {}) {
  const model = copyOwnFields(input, INBOUND_FIELDS);
  model.passenger_ids = copyArray(
    Object.hasOwn(input, "passenger_ids") ? input.passenger_ids : [],
    "inbound.passenger_ids",
  );
  return model;
}

export function createOutboundConnectionModel(input = {}) {
  const model = copyOwnFields(input, OUTBOUND_FIELDS);
  const booked = Object.hasOwn(input, "booked") ? input.booked : [];

  model.booked = copyArray(booked, "outbound.booked").map((entry) =>
    copyOwnFields(entry, ["class", "pax"]),
  );
  model.passenger_ids = copyArray(
    Object.hasOwn(input, "passenger_ids") ? input.passenger_ids : [],
    "outbound.passenger_ids",
  );

  return model;
}
