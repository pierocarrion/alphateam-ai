import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/lib/prisma";
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
    const metric = await prisma.userMetric.create({
      data: {
        userId: user.id,
        date: now,
        type: "wind_down",
        value: 1,
        metadata: parsed.data.mood ?? null,
      },
    });

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
    const count = await prisma.userMetric.count({
      where: { userId: user.id, type: "wind_down", date: { gte: since } },
    });

    return NextResponse.json({ count });
  } catch (error) {
    return jsonError(error);
  }
}
