import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/lib/db";
import { userMetric } from "@drizzle/schema";
import { eq, and, gte, count } from "drizzle-orm";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { requireUser } from "@/server/lib/auth";
import { weekAgo } from "@/server/lib/dates";

const bodySchema = z.object({
  mood: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const user = auth.user;

    const parsed = bodySchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }

    const now = new Date();
    const [metric] = await db
      .insert(userMetric)
      .values({
        userId: user.id,
        date: now,
        type: "wind_down",
        value: 1,
        metadata: parsed.data.mood ?? null,
      })
      .returning();

    return NextResponse.json({ ok: true, metric });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const user = auth.user;

    const since = weekAgo();
    const rows = await db
      .select({ c: count() })
      .from(userMetric)
      .where(
        and(
          eq(userMetric.userId, user.id),
          eq(userMetric.type, "wind_down"),
          gte(userMetric.date, since)
        )
      );
    const total = Number(rows[0]?.c ?? 0);

    return NextResponse.json({ count: total });
  } catch (error) {
    return jsonError(error);
  }
}
