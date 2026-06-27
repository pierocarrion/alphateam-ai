import { createId } from "@paralleldrive/cuid2";

/**
 * Default ID generator: cuid2 (lexicographically sortable, collision-resistant).
 * Mirrors Prisma's `@default(cuid())` so existing rows keep working unchanged.
 */
export const cuid = () => createId();

/** Shared timestamp options to match Prisma's TIMESTAMP(3). */
export const ts = { mode: "date" as const, precision: 3 as const };
