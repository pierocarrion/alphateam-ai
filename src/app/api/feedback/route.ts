import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { feedback, user as userTable } from "@drizzle/schema";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { eq, desc } from "drizzle-orm";
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

    const user = await db.query.user.findFirst({
      where: eq(userTable.email, session.user.email),
      columns: { id: true },
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

    const { active } = await getActiveWorkspace(user.id);
    const [created] = await db
      .insert(feedback)
      .values({
        workspaceId: active?.workspaceId ?? null,
        userId: user.id,
        type: parsed.data.type,
        content: parsed.data.content,
        metricValue: parsed.data.metricValue ?? null,
        tags: parsed.data.tags,
      })
      .returning();

    return NextResponse.json({ feedback: created }, { status: 201 });
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

    const feedbackRows = await db.query.feedback.findMany({
      orderBy: desc(feedback.createdAt),
      limit: 100,
    });

    return NextResponse.json({ feedback: feedbackRows });
  } catch (error) {
    return jsonError(error);
  }
}
