import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { generateMiraResponse } from "@/server/lib/gemini";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";

const requestSchema = z.object({
  message: z.string().min(1).max(2000),
  mood: z.string().optional(),
});

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
      select: { id: true, name: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "We couldn't find your account. Please sign in again." },
        { status: 404 }
      );
    }

    const parseResult = requestSchema.safeParse(await parseRequestBody(request));
    if (!parseResult.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parseResult.error) },
        { status: 400 }
      );
    }

    const { message, mood } = parseResult.data;

    // Fetch recent open tasks for context
    const recentTasks = await prisma.task.findMany({
      where: { userId: user.id, status: "open" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { title: true },
    });

    const gemini = await generateMiraResponse({
      userName: user.name ?? undefined,
      recentTasks: recentTasks.map((t) => t.title),
      mood,
      message,
    });

    if (!gemini.ok) {
      console.error("[chat/mira] Gemini error:", gemini.error);
      return NextResponse.json(
        {
          response:
            "I'm here with you. When you're ready, pick one tiny thing to look at for just two minutes.",
          model: gemini.model,
          usedGemini: false,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      response: gemini.data,
      model: gemini.model,
      usedGemini: true,
    });
  } catch (error) {
    return jsonError(error);
  }
}
