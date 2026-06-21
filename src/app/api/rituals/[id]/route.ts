import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { jsonError, parseRequestBody } from "@/server/lib/apiErrors";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Please sign in to continue." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json(
        { error: "We couldn't find your account. Please sign in again." },
        { status: 404 }
      );
    }

    const { id } = await params;
    const body = (await parseRequestBody(request)) as { completed?: boolean };

    const existing = await prisma.ritualSession.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "We couldn't find that ritual." },
        { status: 404 }
      );
    }

    const completedAt = body.completed ? new Date() : existing.completedAt;

    const ritual = await prisma.ritualSession.update({
      where: { id },
      data: { completedAt },
    });

    if (body.completed && existing.taskId) {
      await prisma.task.update({
        where: { id: existing.taskId },
        data: { status: "done", completedAt: new Date() },
      });
    }

    return NextResponse.json({ ritual });
  } catch (error) {
    return jsonError(error);
  }
}
