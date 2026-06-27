import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/lib/db";
import { workspace, membership, task, pairMatch } from "@drizzle/schema";
import { eq, or, and, desc, inArray } from "drizzle-orm";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { requireUser } from "@/server/lib/auth";

const postSchema = z.object({
  partnerId: z.string().min(1),
  taskId: z.string().min(1).optional(),
  reason: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const user = auth.user;

    const parsed = postSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }

    const { partnerId, taskId, reason } = parsed.data;

    if (partnerId === user.id) {
      return NextResponse.json(
        { error: "You can't pair up with yourself." },
        { status: 400 }
      );
    }

    const userMemberships = await db
      .select({ workspaceId: membership.workspaceId })
      .from(membership)
      .where(eq(membership.userId, user.id));
    const wsIds = userMemberships.map((m) => m.workspaceId);

    const workspaceRow = wsIds.length
      ? await db.query.workspace.findFirst({
          where: inArray(workspace.id, wsIds),
        })
      : undefined;

    if (!workspaceRow) {
      return NextResponse.json(
        { error: "We couldn't find a workspace for this pair-start." },
        { status: 404 }
      );
    }

    const partnerMembership = await db.query.membership.findFirst({
      where: and(
        eq(membership.workspaceId, workspaceRow.id),
        eq(membership.userId, partnerId)
      ),
      columns: { id: true },
    });

    if (!partnerMembership) {
      return NextResponse.json(
        { error: "That person isn't in your workspace." },
        { status: 404 }
      );
    }

    if (taskId) {
      const taskRow = await db.query.task.findFirst({
        where: and(eq(task.id, taskId), eq(task.userId, user.id)),
        columns: { id: true },
      });
      if (!taskRow) {
        return NextResponse.json(
          { error: "We couldn't find that task." },
          { status: 404 }
        );
      }
    }

    const [match] = await db
      .insert(pairMatch)
      .values({
        requesterId: user.id,
        partnerId,
        taskId: taskId ?? null,
        reason:
          reason ?? "Pair-start: begin the same 2 minutes side by side.",
        status: "pending",
      })
      .returning({
        id: pairMatch.id,
        requesterId: pairMatch.requesterId,
        partnerId: pairMatch.partnerId,
        taskId: pairMatch.taskId,
        reason: pairMatch.reason,
        status: pairMatch.status,
        createdAt: pairMatch.createdAt,
      });

    return NextResponse.json({ match, workspace: { id: workspaceRow.id } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const user = auth.user;

    const matches = await db.query.pairMatch.findMany({
      where: or(
        eq(pairMatch.requesterId, user.id),
        eq(pairMatch.partnerId, user.id)
      ),
      orderBy: desc(pairMatch.createdAt),
      limit: 20,
      columns: {
        id: true,
        requesterId: true,
        partnerId: true,
        taskId: true,
        reason: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ matches });
  } catch (error) {
    return jsonError(error);
  }
}
