import { copyArray, copyOwnFields } from "./modelUtils.js";

export function createGroupSummaryModel(input = {}) {
  return copyOwnFields(input, ["group_count", "total_group_pax"]);
}

export function createGroupItemModel(input = {}) {
  return copyOwnFields(input, [
    "id",
    "group_name",
    "pax_count",
    "cabin_class",
    "pnr",
    "remark",
  ]);
}

export function createGroupModel(input = {}) {
  const items = Object.hasOwn(input, "items") ? input.items : [];

  return {
    summary: createGroupSummaryModel(input.summary ?? {}),
    items: copyArray(items, "groups.items").map(createGroupItemModel),
  };
}
