import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { deriveTaskEnhanced, looksLikeTask } from "@/features/tasks/lib/detect";
import { coordinate } from "@/server/lib/aiCoordinator";
import { jsonError, parseRequestBody } from "@/server/lib/apiErrors";

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

    const channel = await prisma.channel.findUnique({
      where: { id },
      include: {
        messages: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
        workspace: { include: { memberships: true } },
      },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "We couldn't find that channel." },
        { status: 404 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    const isMember = channel.workspace.memberships.some((m) => m.userId === user?.id);
    if (!isMember) {
      return NextResponse.json(
        { error: "You don't have access to that channel." },
        { status: 403 }
      );
    }

    // Look for an open task linked to any message in this channel for the current user
    const openTask = await prisma.task.findFirst({
      where: {
        userId: user?.id,
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

    return NextResponse.json({
      channel: { id: channel.id, name: channel.name },
      messages: channel.messages.map((m) => ({
        id: m.id,
        who: personIdFromName(m.user.name ?? ""),
        name: m.user.name,
        time: formatTime(m.createdAt),
        text: m.content,
        userId: m.userId,
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
    const body = (await parseRequestBody(request)) as { text?: string };
    const text = body.text?.trim();
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
      include: { workspace: { include: { memberships: true } } },
    });
    if (!channel) {
      return NextResponse.json(
        { error: "We couldn't find that channel." },
        { status: 404 }
      );
    }

    const isMember = channel.workspace.memberships.some((m) => m.userId === user.id);
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
