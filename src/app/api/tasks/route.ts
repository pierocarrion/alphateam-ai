import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { DetectedTaskDraft } from "@/features/tasks/lib/detect";
import { jsonError, parseRequestBody } from "@/server/lib/apiErrors";

function guessQuadrant(draft: DetectedTaskDraft): string | null {
  const urgent = /tomorrow|tonight|today|asap|urgent|before/.test(draft.due.toLowerCase());
  const important = draft.load === "Heavy" || draft.load === "Medium";
  if (urgent && important) return "q1";
  if (!urgent && important) return "q2";
  if (urgent && !important) return "q3";
  return "q4";
}

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
      messageId?: string;
      draft: DetectedTaskDraft;
    };

    if (!body.draft) {
      return NextResponse.json(
        { error: "Please tell us what task to create." },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        userId: user.id,
        messageId: body.messageId ?? null,
        title: body.draft.title,
        fromQuote: body.draft.fromQuote,
        category: body.draft.category,
        app: body.draft.app,
        due: body.draft.due,
        deadline: body.draft.deadline ?? null,
        load: body.draft.load,
        micro: body.draft.micro,
        action: body.draft.action,
        resource: body.draft.resource,
        selfMade: body.draft.selfMade,
        status: "open",
        quadrant: guessQuadrant(body.draft),
        priority: body.draft.load === "Heavy" ? 5 : body.draft.load === "Medium" ? 3 : 1,
        tags: [body.draft.category.toLowerCase()],
      },
    });

    return NextResponse.json({ task });
  } catch (error) {
    return jsonError(error);
  }
}
