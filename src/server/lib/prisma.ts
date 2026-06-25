import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type { SqlDriverAdapterFactory } from "@prisma/driver-adapter-utils";
import { availableParallelism } from "node:os";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
  pgPool: Pool;
  __testPrismaAdapter?: SqlDriverAdapterFactory;
};

const connectionString = process.env.DATABASE_URL;

/**
 * Pool tuning. Defaults are conservative; override via env in production.
 *  - DB_POOL_MAX: max connections (Cloud SQL: keep below instance max_connections).
 *  - DB_CONNECT_TIMEOUT_MS: connect handshake timeout.
 *  - DB_IDLE_TIMEOUT_MS: idle connection lifetime.
 *  - DB_STATEMENT_TIMEOUT_MS: techo por query para que una lenta no sature el pool.
 */
const poolMax =
  Number.parseInt(process.env.DB_POOL_MAX ?? "", 10) ||
  Math.max(10, (availableParallelism?.() ?? 4) * 5);
const connectTimeoutMs =
  Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS ?? "", 10) || 10_000;
const idleTimeoutMs =
  Number.parseInt(process.env.DB_IDLE_TIMEOUT_MS ?? "", 10) || 30_000;
const statementTimeoutMs =
  Number.parseInt(process.env.DB_STATEMENT_TIMEOUT_MS ?? "", 10) || 15_000;

const pool = globalForPrisma.pgPool ?? new Pool({
  connectionString,
  max: poolMax,
  connectionTimeoutMillis: connectTimeoutMs,
  idleTimeoutMillis: idleTimeoutMs,
  options: `-c statement_timeout=${statementTimeoutMs}`,
});
const adapter = globalForPrisma.__testPrismaAdapter ?? new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}
