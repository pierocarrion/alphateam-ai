import { prisma } from "@/server/lib/prisma";

export const MIRA_BOT_EMAIL = "mira@alphalead.bot";
export const MIRA_BOT_NAME = "Mira";

let cachedBot: { id: string; name: string } | null = null;

/**
 * Ensures the Mira assistant bot user exists and returns its id + name.
 * Used to author Mira's chat messages as a regular `Message` row so replies
 * persist in the channel history (no schema change required).
 */
export async function ensureMiraBotUser(): Promise<{ id: string; name: string }> {
  if (cachedBot) return cachedBot;
  const user = await prisma.user.upsert({
    where: { email: MIRA_BOT_EMAIL },
    update: {},
    create: { email: MIRA_BOT_EMAIL, name: MIRA_BOT_NAME },
    select: { id: true, name: true },
  });
  cachedBot = { id: user.id, name: user.name ?? MIRA_BOT_NAME };
  return cachedBot;
}
