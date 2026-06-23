import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { deriveTaskEnhanced, looksLikeTask } from "@/features/tasks/lib/detect";
import { coordinate } from "@/server/lib/aiCoordinator";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { ensureMiraBotUser } from "@/server/lib/miraBot";
import {
  generateMiraChannelReply,
  isMentionedMira,
  maybeCaptureLeaderAnswer,
} from "@/server/lib/chatKnowledge";

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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "We couldn't find your account. Please sign in again." },
        { status: 404 }
      );
    }

    const channel = await prisma.channel.findUnique({
      where: { id },
      include: {
        messages: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
        workspace: { include: { memberships: { include: { user: { select: { id: true, name: true } } } } } },
        participants: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "We couldn't find that channel." },
        { status: 404 }
      );
    }

    const isMember =
      channel.type === "dm"
        ? channel.participants.some((p) => p.userId === user.id)
        : channel.workspace.memberships.some((m) => m.userId === user.id);
    if (!isMember) {
      return NextResponse.json(
        { error: "You don't have access to that channel." },
        { status: 403 }
      );
    }

    // Look for an open task linked to any message in this channel for the current user
    const openTask = await prisma.task.findFirst({
      where: {
        userId: user.id,
        status: "open",
        messageId: { in: channel.messages.map((m) => m.id) },
      },
      orderBy: { createdAt: "desc" },
    });

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
      channel.type === "dm"
        ? channel.participants.find((p) => p.userId !== user.id)?.user ?? null
        : null;

    return NextResponse.json({
      channel: { id: channel.id, name: channel.name, type: channel.type },
      peer: peer ? { id: peer.id, name: peer.name } : null,
      messages: channel.messages.map((m) => ({
        id: m.id,
        who: personIdFromName(m.user.name ?? ""),
        name: m.user.name,
        time: formatTime(m.createdAt),
        text: m.content,
        userId: m.userId,
      })),
      members: channel.workspace.memberships.map((m) => ({
        id: m.user.id,
        name: m.user.name ?? "Unknown",
        role: m.role,
        personId: personIdFromName(m.user.name ?? ""),
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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json(
        { error: "We couldn't find your account. Please sign in again." },
        { status: 404 }
      );
    }

    const channel = await prisma.channel.findUnique({
      where: { id },
      include: {
        workspace: { include: { memberships: true } },
        participants: true,
      },
    });
    if (!channel) {
      return NextResponse.json(
        { error: "We couldn't find that channel." },
        { status: 404 }
      );
    }

    const isMember =
      channel.type === "dm"
        ? channel.participants.some((p) => p.userId === user.id)
        : channel.workspace.memberships.some((m) => m.userId === user.id);
    if (!isMember) {
      return NextResponse.json(
        { error: "You don't have access to that channel." },
        { status: 403 }
      );
    }

    const message = await prisma.message.create({
      data: {
        channelId: id,
        userId: user.id,
        content: text,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    const detected = looksLikeTask(text) ? await deriveTaskEnhanced(text) : null;

    // Run the agent coordinator so other agents can react to the message.
    const { actions, log } = await coordinate({
      type: "message_sent",
      userId: user.id,
      workspaceId: channel.workspaceId,
      payload: { text, channelId: id, fromUserId: user.id },
    });

    // --- Mira @mention reply (awaited so it streams back with the send) ---
    let miraReply: {
      id: string;
      who: string;
      name: string | null;
      time: string;
      text: string;
      userId: string;
    } | null = null;
    if (isMentionedMira(text)) {
      try {
        const replyText = await generateMiraChannelReply({
          workspaceId: channel.workspaceId,
          messageText: text,
          senderName: user.name,
        });
        if (replyText) {
          const bot = await ensureMiraBotUser();
          const botMessage = await prisma.message.create({
            data: { channelId: id, userId: bot.id, content: replyText },
            include: { user: { select: { id: true, name: true } } },
          });
          miraReply = {
            id: botMessage.id,
            who: personIdFromName(botMessage.user.name ?? ""),
            name: botMessage.user.name,
            time: formatTime(botMessage.createdAt),
            text: botMessage.content,
            userId: botMessage.userId,
          };
        }
      } catch (err) {
        console.error("[channels/messages] mira reply error:", err);
      }
    }

    // --- Leader Q&A auto-capture (background; never blocks the send) ---
    const senderMembership = channel.workspace.memberships.find((m) => m.userId === user.id);
    const isLeader =
      senderMembership?.role === "leader" || senderMembership?.role === "admin";
    if (!isMentionedMira(text) && isLeader) {
      after(() =>
        maybeCaptureLeaderAnswer({
          workspaceId: channel.workspaceId,
          channelId: id,
          leaderUserId: user.id,
          leaderMessageText: text,
        }).catch((err) =>
          console.error("[channels/messages] leader capture error:", err)
        )
      );
    }

    return NextResponse.json({
      message: {
        id: message.id,
        who: personIdFromName(message.user.name ?? ""),
        name: message.user.name,
        time: formatTime(message.createdAt),
        text: message.content,
        userId: message.userId,
      },
      detected,
      miraReply,
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
