import { copyArray, copyOwnFields } from "./modelUtils.js";

const AIRCRAFT_FIELDS = Object.freeze(["type", "seatmap_id"]);

export function createCabinConfiguration(input = []) {
  return copyArray(input, "cabin_configuration").map((entry) =>
    copyOwnFields(entry, ["class", "capacity"]),
  );
}

export function createAircraftModel(input = {}) {
  const model = copyOwnFields(input, AIRCRAFT_FIELDS);

  if (Object.hasOwn(input, "cabin_configuration")) {
    model.cabin_configuration = createCabinConfiguration(
      input.cabin_configuration,
    );
  }

  return model;
}
