import { db } from "@/server/lib/db";
import { user } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/shared/lib/logger";

const log = createLogger("alphaBot");

export const ALPHA_BOT_EMAIL = "alpha@alphalead.bot";
export const ALPHA_BOT_NAME = "Alpha";

let cachedBot: { id: string; name: string } | null = null;

/**
 * Ensures the Alpha assistant bot user exists and returns its id + name.
 * Used to author Alpha's chat messages as a regular `Message` row so replies
 * persist in the channel history (no schema change required).
 *
 * Strategy: SELECT-first (cheap, idempotent), INSERT only when missing. We do
 * NOT rely on `ON CONFLICT DO NOTHING` because the legacy Cloud SQL `User`
 * table (migrated from Prisma) may not infer a unique index on `email` for
 * the Drizzle-generated SQL, and Drizzle threw "No values to set" for the
 * previous `onConflictDoUpdate({ set: {} })` variant. A best-effort catch on
 * the INSERT (e.g. duplicate key from a race) falls back to a fresh SELECT so
 * the bot is always resolvable regardless of the underlying constraint shape.
 */
export async function ensureAlphaBotUser(): Promise<{ id: string; name: string }> {
  if (cachedBot) return cachedBot;

  // 1) Fast path: the bot almost always already exists.
  const existing = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.email, ALPHA_BOT_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    cachedBot = { id: existing[0].id, name: existing[0].name ?? ALPHA_BOT_NAME };
    return cachedBot;
  }

  // 2) First-ever creation: plain INSERT (no onConflict guard so PG surfaces
  //    the true error if a constraint mismatches). If a race inserted it
  //    concurrently we get a duplicate-key error, which we swallow and
  //    re-SELECT.
  try {
    const [created] = await db
      .insert(user)
      .values({ email: ALPHA_BOT_EMAIL, name: ALPHA_BOT_NAME })
      .returning({ id: user.id, name: user.name });
    if (created) {
      cachedBot = { id: created.id, name: created.name ?? ALPHA_BOT_NAME };
      return cachedBot;
    }
  } catch (err) {
    log.warn("alpha bot insert failed, falling back to select", err);
  }

  // 3) Race fallback: either INSERT returned nothing (conflict did happen at
  //    driver level but no row came back) or the INSERT threw a duplicate-key
  //    error. Re-SELECT to resolve the existing row.
  const afterRace = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.email, ALPHA_BOT_EMAIL))
    .limit(1);

  const row = afterRace[0];
  if (!row) {
    // Truly nothing is there and INSERT didn't persist. Surface a clear error
    // so the bot identity problem is visible instead of leaving @Alpha silent.
    throw new Error(
      "ensureAlphaBotUser: could not resolve or create the Alpha bot user"
    );
  }

  cachedBot = { id: row.id, name: row.name ?? ALPHA_BOT_NAME };
  return cachedBot;
}