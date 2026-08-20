export function createD1Mock({ first = [], all = [], run = [] } = {}) {
  const queues = {
    first: [...first],
    all: [...all],
    run: [...run],
  };
  const calls = [];

  class Statement {
    constructor(sql) {
      this.sql = sql;
      this.values = [];
    }

    bind(...values) {
      this.values = values;
      return this;
    }

    first() {
      calls.push({ method: "first", sql: this.sql, values: this.values });
      return Promise.resolve(queues.first.shift() ?? null);
    }

    all() {
      calls.push({ method: "all", sql: this.sql, values: this.values });
      return Promise.resolve(queues.all.shift() ?? { results: [] });
    }

    run() {
      calls.push({ method: "run", sql: this.sql, values: this.values });
      return Promise.resolve(
        queues.run.shift() ?? { success: true, meta: { changes: 1 } },
      );
    }
  }

  const db = {
    prepare(sql) {
      return new Statement(sql);
    },
    batch(statements) {
      calls.push({ method: "batch", statements });
      return Promise.resolve([]);
    },
  };

  return { db, calls };
}
