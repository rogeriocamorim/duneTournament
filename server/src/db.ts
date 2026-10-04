import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

// numeric columns (points, minutes) come back as strings by default
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value));

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

export type Db = pg.Pool;
export type DbClient = pg.PoolClient;

export function createPool(connectionString: string): Db {
  return new pg.Pool({ connectionString, max: 10 });
}

/** Run a function inside a transaction */
export async function withTransaction<T>(db: Db, fn: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Apply every migrations/*.sql file that has not run yet, in name order */
export async function migrate(db: Db): Promise<string[]> {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const file of files) {
    await withTransaction(db, async (client) => {
      // Serialize concurrent starts (e.g. two containers) on the same database
      await client.query("SELECT pg_advisory_xact_lock(424242)");
      const done = await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [file]);
      if (done.rowCount) return;
      await client.query(await readFile(path.join(MIGRATIONS_DIR, file), "utf8"));
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
      applied.push(file);
    });
  }
  return applied;
}

/**
 * Insert many rows with one statement per chunk.
 * `rows` are arrays of values in `columns` order.
 */
export async function insertRows(
  client: DbClient,
  table: string,
  columns: string[],
  rows: unknown[][],
): Promise<void> {
  const CHUNK = 500;
  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK);
    const params: unknown[] = [];
    const values = chunk.map((row) => {
      const placeholders = row.map((value) => {
        params.push(value);
        return `$${params.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    await client.query(`INSERT INTO ${table} (${columns.join(", ")}) VALUES ${values.join(", ")}`, params);
  }
}
