import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const migrationsUrl = new URL("../../migrations/", import.meta.url);
const migrations = readdirSync(migrationsUrl)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(new URL(name, migrationsUrl), "utf8"));

class SQLiteD1Statement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new SQLiteD1Statement(this.database, this.sql, values);
  }

  first() {
    return Promise.resolve(
      this.database.prepare(this.sql).get(...this.values) ?? null,
    );
  }

  all() {
    return Promise.resolve({
      success: true,
      results: this.database.prepare(this.sql).all(...this.values),
    });
  }

  run() {
    return Promise.resolve(this.runSync());
  }

  runSync() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return {
      success: true,
      meta: {
        changes: result.changes,
        last_row_id: Number(result.lastInsertRowid),
      },
    };
  }
}

export function createSQLiteD1() {
  const database = new DatabaseSync(":memory:");
  for (const migration of migrations) database.exec(migration);

  return {
    db: {
      prepare(sql) {
        return new SQLiteD1Statement(database, sql);
      },

      async batch(statements) {
        database.exec("BEGIN");
        try {
          const results = statements.map((statement) => statement.runSync());
          database.exec("COMMIT");
          return results;
        } catch (error) {
          database.exec("ROLLBACK");
          throw error;
        }
      },
    },

    close() {
      database.close();
    },
  };
}
