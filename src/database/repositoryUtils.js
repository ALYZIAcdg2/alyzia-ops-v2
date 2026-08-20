export function assertD1Database(db) {
  if (!db || typeof db.prepare !== "function") {
    throw new TypeError("a D1 database binding is required");
  }
}

export function rowsFromResult(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

export function assertAllowedColumn(field, columnMap) {
  const column = columnMap[field];
  if (!column) {
    throw new RangeError(`unsupported repository field: ${field}`);
  }
  return column;
}

export function collectMappedFields(data, columnMap) {
  const unknownFields = Object.keys(data).filter(
    (field) => !Object.hasOwn(columnMap, field),
  );

  if (unknownFields.length > 0) {
    throw new RangeError(
      `unsupported repository fields: ${unknownFields.join(", ")}`,
    );
  }

  return Object.keys(columnMap)
    .filter((field) => Object.hasOwn(data, field))
    .map((field) => ({
      field,
      column: columnMap[field],
      value: data[field],
    }));
}

export function numberedPlaceholders(count, startAt = 1) {
  return Array.from({ length: count }, (_, index) => `?${index + startAt}`);
}

export async function updateOneField({
  db,
  table,
  whereColumn,
  whereValue,
  field,
  value,
  columnMap,
  touchUpdatedAt = true,
}) {
  assertD1Database(db);
  const column = assertAllowedColumn(field, columnMap);
  const timestampClause = touchUpdatedAt
    ? ", updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
    : "";
  const sql = `UPDATE ${table} SET ${column} = ?1${timestampClause} WHERE ${whereColumn} = ?2`;
  return db.prepare(sql).bind(value, whereValue).run();
}

export async function updateMappedFields({
  db,
  table,
  whereColumn,
  whereValue,
  data,
  columnMap,
  touchUpdatedAt = true,
}) {
  assertD1Database(db);
  const entries = collectMappedFields(data, columnMap);
  if (entries.length === 0) {
    throw new TypeError("at least one field is required");
  }

  const assignments = entries.map(
    ({ column }, index) => `${column} = ?${index + 1}`,
  );
  if (touchUpdatedAt) {
    assignments.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
  }

  const values = entries.map(({ value }) => value);
  values.push(whereValue);
  const sql = `UPDATE ${table} SET ${assignments.join(", ")} WHERE ${whereColumn} = ?${values.length}`;
  return db.prepare(sql).bind(...values).run();
}

export async function upsertMappedFields({
  db,
  table,
  uniqueColumn,
  uniqueValue,
  data,
  columnMap,
  touchUpdatedAt = true,
}) {
  assertD1Database(db);
  const entries = collectMappedFields(data, columnMap);
  const columns = [uniqueColumn, ...entries.map(({ column }) => column)];
  const values = [uniqueValue, ...entries.map(({ value }) => value)];
  const placeholders = numberedPlaceholders(values.length);

  let conflictClause = "DO NOTHING";
  if (entries.length > 0) {
    const assignments = entries.map(
      ({ column }) => `${column} = excluded.${column}`,
    );
    if (touchUpdatedAt) {
      assignments.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
    }
    conflictClause = `DO UPDATE SET ${assignments.join(", ")}`;
  }

  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) ON CONFLICT(${uniqueColumn}) ${conflictClause}`;
  return db.prepare(sql).bind(...values).run();
}
