import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { jsonError, parseRequestBody } from "@/server/lib/apiErrors";

export async function POST(request: Request) {
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

    const body = (await parseRequestBody(request)) as {
      taskId: string;
      feeling?: string;
      durationSec?: number;
    };

    if (!body.taskId) {
      return NextResponse.json(
        { error: "Please pick a task to start with." },
        { status: 400 }
      );
    }

    const task = await prisma.task.findFirst({
      where: { id: body.taskId, userId: user.id },
    });
    if (!task) {
      return NextResponse.json(
        { error: "We couldn't find that task." },
        { status: 404 }
      );
    }

    const ritual = await prisma.ritualSession.create({
      data: {
        userId: user.id,
        taskId: task.id,
        feeling: body.feeling ?? null,
        durationSec: body.durationSec ?? 120,
        startedAt: new Date(),
      },
    });

    return NextResponse.json({ ritual });
  } catch (error) {
    return jsonError(error);
  }
}
