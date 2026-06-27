import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import {
  channel,
  channelInsight,
  channelParticipant,
  membership,
  task,
  user as userTable,
} from "@drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { jsonError } from "@/server/lib/apiErrors";

/**
 * Returns recent Alpha insights + auto-detected open tasks for the channel's
 * workspace, powering the "Wolf/Alpha" side panel (tasks, risks, decisions,
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

    const channelRow = await db.query.channel.findFirst({
      where: eq(channel.id, id),
    });
    if (!channelRow) {
      return NextResponse.json({ error: "Channel not found." }, { status: 404 });
    }

    const user = await db.query.user.findFirst({
      where: eq(userTable.email, session.user.email),
      columns: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
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
      return NextResponse.json({ error: "You don't have access." }, { status: 403 });
    }

    const workspaceMemberUserIds = memberships.map((m) => m.userId);

    const [insights, tasks] = await Promise.all([
      db.query.channelInsight.findMany({
        where: eq(channelInsight.channelId, id),
        orderBy: desc(channelInsight.createdAt),
        limit: 12,
      }),
      workspaceMemberUserIds.length
        ? db
            .select({
              id: task.id,
              title: task.title,
              category: task.category,
              priority: task.priority,
              deadline: task.deadline,
              status: task.status,
              tags: task.tags,
              fromQuote: task.fromQuote,
              userName: userTable.name,
            })
            .from(task)
            .leftJoin(userTable, eq(userTable.id, task.userId))
            .where(
              and(
                eq(task.status, "open"),
                inArray(task.userId, workspaceMemberUserIds)
              )
            )
            .orderBy(desc(task.createdAt))
            .limit(12)
        : Promise.resolve([]),
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
        owner: t.userName ?? null,
        tags: t.tags,
        fromQuote: t.fromQuote,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
