import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/lib/db";
import { task, ritualSession } from "@drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { requireUser } from "@/server/lib/auth";
import { recordRitualCompletion } from "@/server/lib/metrics";

const bodySchema = z.object({
  completed: z.boolean(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const user = auth.user;

    const { id } = await params;
    const parsed = bodySchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }

    const existing = await db.query.ritualSession.findFirst({
      where: and(eq(ritualSession.id, id), eq(ritualSession.userId, user.id)),
    });
    if (!existing) {
      return NextResponse.json(
        { error: "We couldn't find that ritual." },
        { status: 404 }
      );
    }

    const completedAt = parsed.data.completed ? new Date() : existing.completedAt;

    const [ritual] = await db
      .update(ritualSession)
      .set({ completedAt })
      .where(eq(ritualSession.id, id))
      .returning();

    let recoveredMinutes = existing.recoveredMinutes;
    const justCompleted = parsed.data.completed && !existing.completedAt;

    if (justCompleted && existing.taskId) {
      await db
        .update(task)
        .set({ status: "done", completedAt: new Date() })
        .where(eq(task.id, existing.taskId));
    }

    if (justCompleted) {
      const { active } = await getActiveWorkspace(user.id);
      const result = await recordRitualCompletion({
        userId: user.id,
        ritualId: id,
        taskId: existing.taskId,
        durationSec: existing.durationSec,
        workspaceId: active?.workspaceId,
      });
      recoveredMinutes = result.recoveredMinutes;
    }

    return NextResponse.json({ ritual, recoveredMinutes });
  } catch (error) {
    return jsonError(error);
  }
}
