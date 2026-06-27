import { DatabaseError } from "pg";

/**
 * Semantic DB error codes. These deliberately mirror the Prisma error codes
 * already handled by the application (see src/server/lib/apiErrors.ts), so
 * error-handling code can be migrated incrementally without rewriting the
 * friendly-message/status mapping during the Prisma→Drizzle strangulation.
 */
export const DbErrorCode = {
  /** unique_violation — Prisma P2002 (409) */
  UniqueViolation: "P2002",
  /** not found / no rows — Prisma P2025 (404) */
  NotFound: "P2025",
  /** foreign_key_violation — Prisma P2003 (400) */
  ForeignKeyViolation: "P2003",
  /** undefined_table / warmup — Prisma P2021 (503 warmup) */
  UndefinedTable: "P2021",
  /** pool / connection issues — Prisma P2024/P1001/P1002/P1008 (503) */
  ConnectionError: "P2024",
} as const;

export interface SemanticDbError {
  code: string;
  meta?: unknown;
  cause?: unknown;
}

const CONNECTION_PG_CODES = new Set([
  "57P03", // cannot_connect_now
  "08006", // connection_failure
  "08001", // sqlclient_unable_to_establish_sqlconnection
]);

const CONNECTION_ERRNO = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "EPIPE",
]);

/**
 * Maps a thrown value (pg DatabaseError, Node connection error, etc.) to a
 * semantic code matching the Prisma codes the app already understands.
 * Returns `null` when the error is not database-related.
 */
export function toSemanticDbError(error: unknown): SemanticDbError | null {
  if (error instanceof DatabaseError) {
    switch (error.code) {
      case "23505":
        return { code: DbErrorCode.UniqueViolation, cause: error };
      case "23503":
        return { code: DbErrorCode.ForeignKeyViolation, cause: error };
      case "42P01":
        return { code: DbErrorCode.UndefinedTable, cause: error };
      case "40P01": // deadlock_detected
        return { code: DbErrorCode.ConnectionError, cause: error };
      default:
        if (error.code && CONNECTION_PG_CODES.has(error.code)) {
          return { code: DbErrorCode.ConnectionError, cause: error };
        }
        return null;
    }
  }

  // Node-level connection errors (pg throws these before a DatabaseError).
  if (error && typeof error === "object") {
    const code = (error as { code?: unknown }).code;
    const errno = (error as { errno?: unknown }).errno;
    if (typeof code === "string" && CONNECTION_ERRNO.has(code)) {
      return { code: DbErrorCode.ConnectionError, cause: error };
    }
    if (typeof errno === "string" && CONNECTION_ERRNO.has(errno)) {
      return { code: DbErrorCode.ConnectionError, cause: error };
    }
  }

  return null;
}

/** True when `error` looks like a database error the app should map. */
export function isDbError(error: unknown): boolean {
  return toSemanticDbError(error) !== null;
}
