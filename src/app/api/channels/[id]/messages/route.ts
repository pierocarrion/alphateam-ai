import { after } from "next/server";
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
  task,
  user as userTable,
} from "@drizzle/schema";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { deriveTaskEnhanced, looksLikeTask } from "@/features/tasks/lib/detect";
import { coordinate } from "@/server/lib/aiCoordinator";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { ensureAlphaBotUser } from "@/server/lib/alphaBot";
import { createLogger } from "@/shared/lib/logger";
import {
  generateAlphaChannelReply,
  isMentionedAlpha,
  maybeCaptureLeaderAnswer,
} from "@/server/lib/chatKnowledge";
import { publishRealtime } from "@/server/lib/realtime";

const apiLog = createLogger("api:messages");

const postSchema = z.object({
  text: z.string().min(1),
});

export async function GET(
  _request: Request,
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

    const { id } = await params;

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

    const channelRow = await db.query.channel.findFirst({
      where: eq(channel.id, id),
    });

    if (!channelRow) {
      return NextResponse.json(
        { error: "We couldn't find that channel." },
        { status: 404 }
      );
    }

    const [messages, memberships, participants] = await Promise.all([
      db
        .select({
          id: message.id,
          content: message.content,
          userId: message.userId,
          createdAt: message.createdAt,
          userName: userTable.name,
        })
        .from(message)
        .leftJoin(userTable, eq(userTable.id, message.userId))
        .where(eq(message.channelId, id))
        .orderBy(asc(message.createdAt)),
      db
        .select({
          userId: membership.userId,
          role: membership.role,
          userName: userTable.name,
        })
        .from(membership)
        .leftJoin(userTable, eq(userTable.id, membership.userId))
        .where(eq(membership.workspaceId, channelRow.workspaceId)),
      db
        .select({
          userId: channelParticipant.userId,
          userName: userTable.name,
        })
        .from(channelParticipant)
        .leftJoin(userTable, eq(userTable.id, channelParticipant.userId))
        .where(eq(channelParticipant.channelId, id)),
    ]);

    const isMember =
      channelRow.type === "dm"
        ? participants.some((p) => p.userId === user.id)
        : memberships.some((m) => m.userId === user.id);
    if (!isMember) {
      return NextResponse.json(
        { error: "You don't have access to that channel." },
        { status: 403 }
      );
    }

    const messageIds = messages.map((m) => m.id);
    const openTask = messageIds.length
      ? await db.query.task.findFirst({
          where: and(
            eq(task.userId, user.id),
            eq(task.status, "open"),
            inArray(task.messageId, messageIds)
          ),
          orderBy: desc(task.createdAt),
        })
      : null;

    const detected = openTask
      ? {
          title: openTask.title,
          fromQuote: openTask.fromQuote ?? "",
          category: openTask.category,
          app: openTask.app,
          due: openTask.due ?? "",
          load: openTask.load,
          micro: openTask.micro,
          action: openTask.action,
          resource: openTask.resource,
          selfMade: openTask.selfMade,
        }
      : null;

    const peer =
      channelRow.type === "dm"
        ? participants.find((p) => p.userId !== user.id) ?? null
        : null;

    return NextResponse.json({
      channel: { id: channelRow.id, name: channelRow.name, type: channelRow.type },
      peer: peer ? { id: peer.userId, name: peer.userName } : null,
      messages: messages.map((m) => ({
        id: m.id,
        who: personIdFromName(m.userName ?? ""),
        name: m.userName,
        time: formatTime(m.createdAt),
        text: m.content,
        userId: m.userId,
      })),
      members: memberships.map((m) => ({
        id: m.userId,
        name: m.userName ?? "Unknown",
        role: m.role,
        personId: personIdFromName(m.userName ?? ""),
      })),
      detected,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
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

    const { id } = await params;
    const parsed = postSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }
    const text = parsed.data.text.trim();
    if (!text) {
      return NextResponse.json(
        { error: "Please add some text to your message." },
        { status: 400 }
      );
    }

    const user = await db.query.user.findFirst({
      where: eq(userTable.email, session.user.email),
    });
    if (!user) {
      return NextResponse.json(
        { error: "We couldn't find your account. Please sign in again." },
        { status: 404 }
      );
    }

    const channelRow = await db.query.channel.findFirst({
      where: eq(channel.id, id),
    });
    if (!channelRow) {
      return NextResponse.json(
        { error: "We couldn't find that channel." },
        { status: 404 }
      );
    }

    const [memberships, participants] = await Promise.all([
      db
        .select({ userId: membership.userId, role: membership.role })
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
      return NextResponse.json(
        { error: "You don't have access to that channel." },
        { status: 403 }
      );
    }

    const [createdMessage] = await db
      .insert(message)
      .values({
        channelId: id,
        userId: user.id,
        content: text,
      })
      .returning();
    const senderName = user.name;

    const detected = looksLikeTask(text) ? await deriveTaskEnhanced(text) : null;

    const { actions, log } = await coordinate({
      type: "message_sent",
      userId: user.id,
      workspaceId: channelRow.workspaceId,
      payload: { text, channelId: id, fromUserId: user.id },
    });

    let alphaReply: {
      id: string;
      who: string;
      name: string | null;
      time: string;
      text: string;
      userId: string;
    } | null = null;
    if (isMentionedAlpha(text)) {
      try {
        const { parseAlphaCommand } = await import("@/features/chat/application/alphaCommands");
        const { runAlphaInChannel } = await import("@/server/lib/alphaCommandsService");
        const command = parseAlphaCommand(text);
        let replyText: string | null = null;
        if (command.command !== "general") {
          const { result } = await runAlphaInChannel({ channelId: id, text });
          replyText = result.reply;
        } else {
          replyText = await generateAlphaChannelReply({
            workspaceId: channelRow.workspaceId,
            messageText: text,
            senderName: user.name,
          });
        }
        if (replyText) {
          const bot = await ensureAlphaBotUser();
          const [botMessage] = await db
            .insert(message)
            .values({ channelId: id, userId: bot.id, content: replyText })
            .returning();
          alphaReply = {
            id: botMessage.id,
            who: personIdFromName(bot.name ?? ""),
            name: bot.name,
            time: formatTime(botMessage.createdAt),
            text: botMessage.content,
            userId: botMessage.userId,
          };
        }
      } catch (err) {
        apiLog.error("alpha reply error", err);
      }
    }

    const senderMembership = memberships.find((m) => m.userId === user.id);
    const isLeader =
      senderMembership?.role === "leader" || senderMembership?.role === "admin";
    if (!isMentionedAlpha(text) && isLeader) {
      after(() =>
        maybeCaptureLeaderAnswer({
          workspaceId: channelRow.workspaceId,
          channelId: id,
          leaderUserId: user.id,
          leaderMessageText: text,
        }).catch((err) =>
          apiLog.error("leader capture error", err)
        )
      );
    }

    publishRealtime("message_sent", {
      workspaceId: channelRow.workspaceId,
      channelId: id,
      messageId: createdMessage.id,
      data: {
        text: createdMessage.content,
        userId: createdMessage.userId,
        name: senderName,
      },
    });
    if (alphaReply) {
      publishRealtime("alpha_reply", {
        workspaceId: channelRow.workspaceId,
        channelId: id,
        messageId: alphaReply.id,
        data: { text: alphaReply.text, name: alphaReply.name },
      });
    }
    if (detected) {
      publishRealtime("task_detected", {
        workspaceId: channelRow.workspaceId,
        channelId: id,
        data: { title: detected.title },
      });
    }

    return NextResponse.json({
      message: {
        id: createdMessage.id,
        who: personIdFromName(senderName ?? ""),
        name: senderName,
        time: formatTime(createdMessage.createdAt),
        text: createdMessage.content,
        userId: createdMessage.userId,
      },
      detected,
      alphaReply,
      agentActions: actions,
      _agentLog: log,
    });
  } catch (error) {
    return jsonError(error);
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).replace(/\s/g, "").toLowerCase();
}

function personIdFromName(name: string): string {
  const map: Record<string, string> = {
    Maya: "maya",
    Daniel: "daniel",
    "Sofía": "sofia",
    Theo: "theo",
    Priya: "priya",
  };
  return map[name] ?? name.toLowerCase();
}
