import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/lib/db";
import { task, ritualSession } from "@drizzle/schema";
import { eq, and } from "drizzle-orm";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { requireUser } from "@/server/lib/auth";

const bodySchema = z.object({
  taskId: z.string().min(1),
  feeling: z.string().optional(),
  durationSec: z.number().int().positive().optional(),
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

    const { taskId, feeling, durationSec } = parsed.data;

    const taskRow = await db.query.task.findFirst({
      where: and(eq(task.id, taskId), eq(task.userId, user.id)),
      columns: { id: true },
    });
    if (!taskRow) {
      return NextResponse.json(
        { error: "We couldn't find that task." },
        { status: 404 }
      );
    }

    const [ritual] = await db
      .insert(ritualSession)
      .values({
        userId: user.id,
        taskId: taskRow.id,
        feeling: feeling ?? null,
        durationSec: durationSec ?? 120,
        startedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ ritual });
  } catch (error) {
    return jsonError(error);
  }
}
