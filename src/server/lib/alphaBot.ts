import { db } from "@/server/lib/db";
import { user } from "@drizzle/schema";

export const ALPHA_BOT_EMAIL = "alpha@alphalead.bot";
export const ALPHA_BOT_NAME = "Alpha";

let cachedBot: { id: string; name: string } | null = null;

/**
 * Ensures the Alpha assistant bot user exists and returns its id + name.
 * Used to author Alpha's chat messages as a regular `Message` row so replies
 * persist in the channel history (no schema change required).
 */
export async function ensureAlphaBotUser(): Promise<{ id: string; name: string }> {
  if (cachedBot) return cachedBot;
  const [row] = await db
    .insert(user)
    .values({ email: ALPHA_BOT_EMAIL, name: ALPHA_BOT_NAME })
    .onConflictDoUpdate({
      target: user.email,
      set: {},
    })
    .returning({ id: user.id, name: user.name });
  cachedBot = { id: row.id, name: row.name ?? ALPHA_BOT_NAME };
  return cachedBot;
}
