import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import {
  channel,
  channelParticipant,
  membership,
  message,
  user as userTable,
} from "@drizzle/schema";
import { eq, and } from "drizzle-orm";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { ensureAlphaBotUser } from "@/server/lib/alphaBot";
import { runAlphaInChannel } from "@/server/lib/alphaCommandsService";

const bodySchema = z.object({
  text: z.string().min(1).max(4000),
  postReply: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }
    const { id } = await params;
    const parsed = bodySchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: toFriendlyMessage(parsed.error) }, { status: 400 });
    }

    const user = await db.query.user.findFirst({
      where: eq(userTable.email, session.user.email),
      columns: { id: true, name: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const channelRow = await db.query.channel.findFirst({
      where: eq(channel.id, id),
    });
    if (!channelRow) {
      return NextResponse.json({ error: "Channel not found." }, { status: 404 });
    }

    const [memberships, participants] = await Promise.all([
      db
        .select({ userId: membership.userId })
        .from(membership)
        .where(eq(membership.workspaceId, channelRow.workspaceId)),
      db
        .select({ userId: channelParticipant.userId })
        .from(channelParticipant)
        .where(eq(channelParticipant.channelId, id)),
    ]);

    const isMember =
      channelRow.type === "dm"
        ? participants.some((p) => p.userId === user.id)
        : memberships.some((m) => m.userId === user.id);
    if (!isMember) {
      return NextResponse.json({ error: "You don't have access to that channel." }, { status: 403 });
    }

    const { result, parsed: command } = await runAlphaInChannel({ channelId: id, text: parsed.data.text });

    let postedMessage: { id: string; text: string } | null = null;
    if (parsed.data.postReply) {
      const bot = await ensureAlphaBotUser();
      const [msg] = await db
        .insert(message)
        .values({ channelId: id, userId: bot.id, content: result.reply })
        .returning({ id: message.id, content: message.content });
      postedMessage = { id: msg.id, text: msg.content };
    }

    return NextResponse.json({
      command: command.command,
      argument: command.argument,
      reply: result.reply,
      usedAi: result.usedAi,
      structured: result.structured ?? null,
      postedMessage,
    });
  } catch (error) {
    return jsonError(error);
  }
}
