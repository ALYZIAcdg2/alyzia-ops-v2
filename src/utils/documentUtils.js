export const DOCUMENT_CLASSIFICATIONS = Object.freeze([
  "ETKT",
  "EMD",
  "UNCLASSIFIED",
]);

export function classifyDocument({
  value,
  explicitType,
  associated_code,
  remark,
  passenger_id,
  document_hint,
} = {}) {
  if (value === undefined || value === null) {
    throw new TypeError("document value is required");
  }

  if (explicitType === "ETKT") {
    return {
      type: "ETKT",
      etkt_number: value,
      ...(passenger_id === undefined ? {} : { passenger_id }),
    };
  }

  if (explicitType === "EMD") {
    return {
      type: "EMD",
      emd_number: value,
      ...(passenger_id === undefined ? {} : { passenger_id }),
      ...(associated_code === undefined ? {} : { associated_code }),
      ...(remark === undefined ? {} : { remark }),
    };
  }

  return {
    type: "UNCLASSIFIED",
    document_value: value,
    ...(passenger_id === undefined ? {} : { passenger_id }),
    ...(document_hint === undefined ? {} : { document_hint }),
  };
}
