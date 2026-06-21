import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/lib/prisma";
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

    const existing = await prisma.ritualSession.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "We couldn't find that ritual." },
        { status: 404 }
      );
    }

    const completedAt = parsed.data.completed ? new Date() : existing.completedAt;

    const ritual = await prisma.ritualSession.update({
      where: { id },
      data: { completedAt },
    });

    let recoveredMinutes = existing.recoveredMinutes;
    const justCompleted = parsed.data.completed && !existing.completedAt;

    if (justCompleted && existing.taskId) {
      await prisma.task.update({
        where: { id: existing.taskId },
        data: { status: "done", completedAt: new Date() },
      });
    }

    if (justCompleted) {
      const result = await recordRitualCompletion({
        userId: user.id,
        ritualId: id,
        taskId: existing.taskId,
        durationSec: existing.durationSec,
      });
      recoveredMinutes = result.recoveredMinutes;
    }

    return NextResponse.json({ ritual, recoveredMinutes });
  } catch (error) {
    return jsonError(error);
  }
}
