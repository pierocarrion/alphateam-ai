import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/lib/prisma";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { requireUser } from "@/server/lib/auth";
import { recordTaskCompletion } from "@/server/lib/metrics";

const patchSchema = z.object({
  status: z.string().min(1).optional(),
  completedAt: z.string().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const user = auth.user;

    const { id } = await params;
    const task = await prisma.task.findFirst({
      where: { id, userId: user.id },
    });

    if (!task) {
      return NextResponse.json(
        { error: "We couldn't find that task." },
        { status: 404 }
      );
    }

    return NextResponse.json({ task });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const user = auth.user;

    const { id } = await params;
    const existing = await prisma.task.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "We couldn't find that task." },
        { status: 404 }
      );
    }

    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const user = auth.user;

    const { id } = await params;
    const parsed = patchSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }

    const existing = await prisma.task.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "We couldn't find that task." },
        { status: 404 }
      );
    }

    const nextStatus = parsed.data.status ?? existing.status;
    const task = await prisma.task.update({
      where: { id },
      data: {
        status: nextStatus,
        completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : existing.completedAt,
      },
    });

    if (nextStatus === "done" && existing.status !== "done") {
      await recordTaskCompletion(user.id);
    }

    return NextResponse.json({ task });
  } catch (error) {
    return jsonError(error);
  }
}
