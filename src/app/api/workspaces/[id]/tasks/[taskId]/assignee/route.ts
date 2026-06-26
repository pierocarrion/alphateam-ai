import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/lib/prisma";
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

    const existing = await prisma.projectTask.findUnique({
      where: { id: taskId },
      select: { workspaceId: true, assigneeId: true },
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
      const member = await prisma.membership.findUnique({
        where: {
          userId_workspaceId: { userId: requestedAssignee, workspaceId: auth.workspaceId },
        },
        select: { status: true },
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

    const task = await prisma.projectTask.update({
      where: { id: taskId },
      data: { assigneeId: requestedAssignee },
      include: {
        assignee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

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
          const workspace = await prisma.workspace.findUnique({
            where: { id: auth.workspaceId },
            select: { name: true },
          });
          await notifyUser({
            userId: newAssigneeId,
            type: "task_assigned",
            title: "Te asignaron una tarea",
            body: `“${task.title}”${
              workspace ? ` · ${workspace.name}` : ""
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
