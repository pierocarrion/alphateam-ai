import { prisma } from "@/server/lib/prisma";

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
  const user = await prisma.user.upsert({
    where: { email: ALPHA_BOT_EMAIL },
    update: {},
    create: { email: ALPHA_BOT_EMAIL, name: ALPHA_BOT_NAME },
    select: { id: true, name: true },
  });
  cachedBot = { id: user.id, name: user.name ?? ALPHA_BOT_NAME };
  return cachedBot;
}
