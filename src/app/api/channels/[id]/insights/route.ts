import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { jsonError } from "@/server/lib/apiErrors";

/**
 * Returns recent Mira insights + auto-detected open tasks for the channel's
 * workspace, powering the "Wolf/Mira" side panel (tasks, risks, decisions,
 * summaries) in the enriched Group Chat.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }
    const { id } = await params;

    const channel = await prisma.channel.findUnique({
      where: { id },
      include: { workspace: { include: { memberships: true } }, participants: true },
    });
    if (!channel) {
      return NextResponse.json({ error: "Channel not found." }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    const isMember =
      channel.type === "dm"
        ? channel.participants.some((p) => p.userId === user.id)
        : channel.workspace.memberships.some((m) => m.userId === user.id);
    if (!isMember) {
      return NextResponse.json({ error: "You don't have access." }, { status: 403 });
    }

    const [insights, tasks] = await Promise.all([
      prisma.channelInsight.findMany({
        where: { channelId: id },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.task.findMany({
        where: {
          status: "open",
          user: { memberships: { some: { workspaceId: channel.workspaceId } } },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { user: { select: { name: true } } },
      }),
    ]);

    return NextResponse.json({
      insights: insights.map((i) => ({
        id: i.id,
        type: i.type,
        payload: i.payload,
        createdAt: i.createdAt,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        priority: t.priority,
        deadline: t.deadline,
        status: t.status,
        owner: t.user.name ?? null,
        tags: t.tags,
        fromQuote: t.fromQuote,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
