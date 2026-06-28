/**
 * Isomorphic logger with leveled scopes. No external dependencies.
 *
 * - Client (browser): pretty `console` output with `[scope][LEVEL]` prefix.
 * - Server (Node/edge): single-line JSON to stdout (parseable).
 *
 * Level filtering is driven by env vars:
 *   - NEXT_PUBLIC_LOG_LEVEL  (client + server)
 *   - LOG_LEVEL              (server override, higher priority)
 *
 * Usage:
 *   import { createLogger } from "@/shared/lib/logger";
 *   const log = createLogger("mic");
 *   log.info("started", { lang });
 *   log.error("boom", err);
 *   const sub = log.scope("chat"); // -> [mic:chat]
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

function resolveLevel(): LogLevel {
  const raw =
    (typeof process !== "undefined" && (process.env?.LOG_LEVEL as string)) ||
    (typeof process !== "undefined" &&
      (process.env?.NEXT_PUBLIC_LOG_LEVEL as string)) ||
    "info";
  const normalized = String(raw ?? "info").toLowerCase() as LogLevel;
  return LEVEL_WEIGHT[normalized] !== undefined ? normalized : "info";
}

const MIN_LEVEL = LEVEL_WEIGHT[resolveLevel()];

const isServer = typeof window === "undefined";

function safeSerialize(value: unknown): unknown {
  if (value instanceof Error) {
    return serializeError(value, new Set());
  }
  if (typeof value === "object" && value !== null) {
    try {
      JSON.stringify(value);
      return value;
    } catch {
      return String(value);
    }
  }
  return value;
}

/**
 * Serializes an Error INCLUDING its `cause` chain (Drizzle/pg wrap the real
 * PostgreSQL error there as `Error.cause`), so server logs reveal the actual
 * underlying driver error instead of just the wrapping "Failed query: …".
 */
function serializeError(err: Error, seen: Set<unknown>): Record<string, unknown> {
  if (seen.has(err)) return { name: err.name, message: "[circular]" };
  seen.add(err);
  const out: Record<string, unknown> = {
    name: err.name,
    message: err.message,
    stack: err.stack,
  };
  // Preserve commonly used Error-compatible fields (DriverData, code, …)
  const anyErr = err as Error & {
    code?: unknown;
    detail?: unknown;
    constraint?: unknown;
    table?: unknown;
    column?: unknown;
    statusCode?: unknown;
  };
  if (anyErr.code !== undefined) out.code = anyErr.code;
  if (anyErr.detail !== undefined) out.detail = anyErr.detail;
  if (anyErr.constraint !== undefined) out.constraint = anyErr.constraint;
  if (anyErr.table !== undefined) out.table = anyErr.table;
  if (anyErr.column !== undefined) out.column = anyErr.column;
  if (anyErr.statusCode !== undefined) out.statusCode = anyErr.statusCode;
  if (err.cause instanceof Error) {
    out.cause = serializeError(err.cause, seen);
  } else if (err.cause !== undefined && err.cause !== null) {
    out.cause = safeSerialize(err.cause);
  }
  return out;
}

function emit(
  level: Exclude<LogLevel, "silent">,
  scope: string,
  message: string,
  context?: unknown
) {
  if (LEVEL_WEIGHT[level] < MIN_LEVEL) return;

  if (isServer) {
    // Structured single-line JSON for server logs.
    const record: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      scope,
      msg: message,
    };
    if (context !== undefined) record.ctx = safeSerialize(context);
    // Use console directly to avoid recursion; one line.
    const line = JSON.stringify(record);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else if (level === "debug") console.debug(line);
    else console.log(line);
    return;
  }

  // Client: pretty prefixed output.
  const prefix = `%c[${scope}][${level.toUpperCase()}]`;
  const style =
    level === "error"
      ? "color:#fff;background:#b91c1c;padding:1px 4px;border-radius:3px"
      : level === "warn"
        ? "color:#fff;background:#b45309;padding:1px 4px;border-radius:3px"
        : level === "debug"
          ? "color:#6b7280"
          : "color:#2563eb";
  const rest = context === undefined ? [] : [safeSerialize(context)];
  if (level === "error") console.error(prefix, style, message, ...rest);
  else if (level === "warn") console.warn(prefix, style, message, ...rest);
  else if (level === "debug") console.debug(prefix, style, message, ...rest);
  else console.log(prefix, style, message, ...rest);
}

export interface Logger {
  scope(child: string): Logger;
  debug(message: string, context?: unknown): void;
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
  readonly scopeName: string;
}

export function createLogger(scope: string): Logger {
  return {
    scopeName: scope,
    scope(child: string) {
      return createLogger(`${scope}:${child}`);
    },
    debug(message, context) {
      emit("debug", scope, message, context);
    },
    info(message, context) {
      emit("info", scope, message, context);
    },
    warn(message, context) {
      emit("warn", scope, message, context);
    },
    error(message, context) {
      emit("error", scope, message, context);
    },
  };
}

/** Root logger; scope it for each subsystem. */
export const logger = createLogger("app");
