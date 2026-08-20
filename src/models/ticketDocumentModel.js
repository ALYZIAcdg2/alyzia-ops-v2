import { copyArray, copyOwnFields } from "./modelUtils.js";

export const DOCUMENT_TYPES = Object.freeze(["ETKT", "EMD", "UNCLASSIFIED"]);

export function createEtktModel(input = {}) {
  return copyOwnFields(input, ["number", "passenger_id"]);
}

export function createEmdModel(input = {}) {
  return copyOwnFields(input, [
    "number",
    "passenger_id",
    "associated_code",
    "remark",
  ]);
}

export function createUnclassifiedDocumentModel(input = {}) {
  return copyOwnFields(input, [
    "document_value",
    "document_hint",
    "passenger_id",
  ]);
}

export function createTicketDocumentModel(input = {}) {
  const etkt = Object.hasOwn(input, "etkt") ? input.etkt : [];
  const emds = Object.hasOwn(input, "emds") ? input.emds : [];
  const unclassified = Object.hasOwn(input, "unclassified")
    ? input.unclassified
    : [];

  return {
    etkt: copyArray(etkt, "tickets_documents.etkt").map(createEtktModel),
    emds: copyArray(emds, "tickets_documents.emds").map(createEmdModel),
    unclassified: copyArray(
      unclassified,
      "tickets_documents.unclassified",
    ).map(createUnclassifiedDocumentModel),
  };
}
