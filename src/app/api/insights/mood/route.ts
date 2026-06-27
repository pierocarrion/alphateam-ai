import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { user as userTable, membership, channel, message } from "@drizzle/schema";
import { eq, gte, desc, and, inArray } from "drizzle-orm";
import { analyzeCrewMood } from "@/server/lib/gemini";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { createLogger } from "@/shared/lib/logger";

const log = createLogger("api:insights-mood");

const requestSchema = z.object({
  workspaceId: z.string().min(1),
  days: z.coerce.number().min(1).max(30).default(7),
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

    const parseResult = requestSchema.safeParse(await parseRequestBody(request));
    if (!parseResult.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parseResult.error) },
        { status: 400 }
      );
    }

    const { workspaceId, days } = parseResult.data;

    const membershipRow = await db.query.membership.findFirst({
      where: and(
        eq(membership.userId, user.id),
        eq(membership.workspaceId, workspaceId)
      ),
      columns: { id: true },
    });

    if (!membershipRow) {
      return NextResponse.json(
        { error: "You don't have access to that workspace." },
        { status: 403 }
      );
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const channelRows = await db
      .select({ id: channel.id })
      .from(channel)
      .where(eq(channel.workspaceId, workspaceId));
    const channelIds = channelRows.map((r) => r.id);

    const messages =
      channelIds.length > 0
        ? await db
            .select({
              userId: message.userId,
              content: message.content,
              createdAt: message.createdAt,
            })
            .from(message)
            .where(
              and(
                inArray(message.channelId, channelIds),
                gte(message.createdAt, since)
              )
            )
            .orderBy(desc(message.createdAt))
            .limit(100)
        : [];

    if (messages.length === 0) {
      return NextResponse.json({
        mood: { value: 50, label: "neutral" },
        signals: [],
        usedGemini: false,
        messageCount: 0,
      });
    }

    const gemini = await analyzeCrewMood(
      messages.map((m) => ({
        userId: m.userId,
        text: m.content,
        createdAt: m.createdAt.toISOString(),
      }))
    );

    if (!gemini.ok) {
      log.error("Gemini error", gemini.error);
      return NextResponse.json(
        {
          mood: { value: 50, label: "neutral" },
          signals: [],
          usedGemini: false,
          messageCount: messages.length,
          error: "We couldn't read the room right now. Showing a neutral mood.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ...gemini.data,
      usedGemini: true,
      messageCount: messages.length,
    });
  } catch (error) {
    return jsonError(error);
  }
}
