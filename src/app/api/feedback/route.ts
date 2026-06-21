import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { z } from "zod";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";

const schema = z.object({
  type: z.enum(["win", "struggle", "testimonial", "metric"]),
  content: z.string().min(1).max(2000),
  metricValue: z.number().optional(),
  tags: z.array(z.string()).default([]),
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
      include: { memberships: { take: 1 } },
    });
    if (!user) {
      return NextResponse.json(
        { error: "We couldn't find your account. Please sign in again." },
        { status: 404 }
      );
    }

    const body = await parseRequestBody(request);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }

    const membership = user.memberships[0];
    const feedback = await prisma.feedback.create({
      data: {
        workspaceId: membership?.workspaceId ?? null,
        userId: user.id,
        type: parsed.data.type,
        content: parsed.data.content,
        metricValue: parsed.data.metricValue,
        tags: parsed.data.tags,
      },
    });

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Please sign in to continue." },
        { status: 401 }
      );
    }

    const feedback = await prisma.feedback.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ feedback });
  } catch (error) {
    return jsonError(error);
  }
}
