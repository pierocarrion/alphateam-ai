import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { availableParallelism } from "node:os";
import * as schema from "@drizzle/schema";

export type Db = NodePgDatabase<typeof schema>;

/**
 * Shared connection pool, cached on the global so HMR in dev and serverless
 * warm invocations reuse a single pool against Cloud SQL.
 */
type GlobalWithPool = {
  pgPool?: Pool;
  __drizzleDb?: Db;
  /** PGlite-backed Drizzle instance injected by the test harness. */
  __testDb?: Db;
};

const g = globalThis as unknown as GlobalWithPool;

const connectionString = process.env.DATABASE_URL;

const poolMax =
  Number.parseInt(process.env.DB_POOL_MAX ?? "", 10) ||
  Math.max(10, (availableParallelism?.() ?? 4) * 5);
const connectTimeoutMs =
  Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS ?? "", 10) || 10_000;
const idleTimeoutMs =
  Number.parseInt(process.env.DB_IDLE_TIMEOUT_MS ?? "", 10) || 30_000;
const statementTimeoutMs =
  Number.parseInt(process.env.DB_STATEMENT_TIMEOUT_MS ?? "", 10) || 15_000;

function createPool(): Pool {
  return new Pool({
    connectionString,
    max: poolMax,
    connectionTimeoutMillis: connectTimeoutMs,
    idleTimeoutMillis: idleTimeoutMs,
    options: `-c statement_timeout=${statementTimeoutMs}`,
  });
}

/**
 * Drizzle client. In tests the harness injects a PGlite-backed instance via
 * `global.__testDb` (see src/tests/helpers/db.ts); in runtime we build a
 * `node-postgres` client over the shared pool.
 */
export const db: Db =
  g.__testDb ??
  g.__drizzleDb ??
  (() => {
    const pool = g.pgPool ?? createPool();
    if (process.env.NODE_ENV !== "production") {
      g.pgPool = pool;
    }
    const instance = drizzle(pool, { schema });
    if (process.env.NODE_ENV !== "production") {
      g.__drizzleDb = instance;
    }
    return instance;
  })();
