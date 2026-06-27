import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/lib/db";
import { projectTask, membership, user, workspace as workspaceTable } from "@drizzle/schema";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { requireProjectMember, isLeaderOrAdmin } from "@/server/lib/requireProjectMember";
import { publishRealtime } from "@/server/lib/realtime";
import { notifyUser, safeAfter } from "@/server/lib/notifications";

const assignSchema = z.object({
  // null = unassign. A userId = assign to that member.
  assigneeId: z.string().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: rawProjectId, taskId } = await params;
    const auth = await requireProjectMember(rawProjectId);
    if (auth.response) return auth.response;

    const parsed = assignSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }

    const existing = await db.query.projectTask.findFirst({
      where: eq(projectTask.id, taskId),
      columns: { workspaceId: true, assigneeId: true },
    });
    if (!existing || existing.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "No encontramos esa tarea." }, { status: 404 });
    }

    const leader = isLeaderOrAdmin(auth.role);
    const requestedAssignee = parsed.data.assigneeId;

    // Members can only assign to themselves; leaders can assign to anyone or unassign.
    if (requestedAssignee !== null) {
      if (!leader && requestedAssignee !== auth.user.id) {
        return NextResponse.json(
          { error: "Solo el líder puede asignar tareas a otras personas." },
          { status: 403 }
        );
      }
      const member = await db.query.membership.findFirst({
        where: and(
          eq(membership.userId, requestedAssignee),
          eq(membership.workspaceId, auth.workspaceId)
        ),
        columns: { status: true },
      });
      if (!member || member.status !== "active") {
        return NextResponse.json(
          { error: "Esa persona no es miembro activo del proyecto." },
          { status: 400 }
        );
      }
    } else if (!leader) {
      // Members cannot unassign; only reassign to themselves.
      return NextResponse.json(
        { error: "Solo el líder puede desasignar tareas." },
        { status: 403 }
      );
    }

    const [updated] = await db.update(projectTask).set({ assigneeId: requestedAssignee }).where(eq(projectTask.id, taskId)).returning();

    const [assigneeUser, creatorUser] = await Promise.all([
      updated.assigneeId
        ? db.query.user.findFirst({
            where: eq(user.id, updated.assigneeId),
            columns: { id: true, name: true },
          })
        : Promise.resolve(null),
      db.query.user.findFirst({
        where: eq(user.id, updated.createdById),
        columns: { id: true, name: true },
      }),
    ]);

    const task = { ...updated, assignee: assigneeUser, createdBy: creatorUser };

    // Realtime: let connected Kanban clients refresh instantly.
    publishRealtime("task_updated", {
      workspaceId: auth.workspaceId,
      channelId: auth.workspaceId,
      data: { taskId: task.id, assigneeId: requestedAssignee },
    });

    // Notify the newly assigned member (skip self-assign to avoid noise).
    const newAssigneeId = requestedAssignee;
    if (newAssigneeId && newAssigneeId !== auth.user.id) {
      safeAfter(async () => {
        try {
          const ws = await db.query.workspace.findFirst({
            where: eq(workspaceTable.id, auth.workspaceId),
            columns: { name: true },
          });
          await notifyUser({
            userId: newAssigneeId,
            type: "task_assigned",
            title: "Te asignaron una tarea",
            body: `“${task.title}”${
              ws ? ` · ${ws.name}` : ""
            }`,
            data: {
              workspaceId: auth.workspaceId,
              taskId: task.id,
            },
            workspaceId: auth.workspaceId,
            url: `/${auth.workspaceId}/tasks`,
          });
        } catch {
          // best-effort
        }
      });
    }

    return NextResponse.json({ task });
  } catch (error) {
    return jsonError(error);
  }
}
