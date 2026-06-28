import { db } from "@/server/lib/db";
import { user } from "@drizzle/schema";
import { eq } from "drizzle-orm";

export const ALPHA_BOT_EMAIL = "alpha@alphalead.bot";
export const ALPHA_BOT_NAME = "Alpha";

let cachedBot: { id: string; name: string } | null = null;

/**
 * Ensures the Alpha assistant bot user exists and returns its id + name.
 * Used to author Alpha's chat messages as a regular `Message` row so replies
 * persist in the channel history (no schema change required).
 *
 * Uses `onConflictDoNothing` (never `onConflictDoUpdate` with an empty `set`,
 * which drizzle rejects with "No values to set") and then falls back to a lookup
 * when the row already existed, so the bot id/name is always returned.
 */
export async function ensureAlphaBotUser(): Promise<{ id: string; name: string }> {
  if (cachedBot) return cachedBot;

  // Best-effort insert; if the bot already exists (the common path after first
  // creation) `.returning()` yields an empty array and we look it up instead.
  let rows = await db
    .insert(user)
    .values({ email: ALPHA_BOT_EMAIL, name: ALPHA_BOT_NAME })
    .onConflictDoNothing({ target: user.email })
    .returning({ id: user.id, name: user.name });

  if (rows.length === 0) {
    rows = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(eq(user.email, ALPHA_BOT_EMAIL));
  }

  const row = rows[0];
  if (!row) {
    // Extremely unlikely fallback: the prior insert didn't persist and the
    // lookup found nothing. Re-insert without the conflict guard so we never
    // leave Alpha without an identity.
    const [created] = await db
      .insert(user)
      .values({ email: ALPHA_BOT_EMAIL, name: ALPHA_BOT_NAME })
      .returning({ id: user.id, name: user.name });
    cachedBot = { id: created.id, name: created.name ?? ALPHA_BOT_NAME };
    return cachedBot;
  }

  cachedBot = { id: row.id, name: row.name ?? ALPHA_BOT_NAME };
  return cachedBot;
}
