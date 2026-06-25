import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/lib/prisma";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { requireProjectMember, isLeaderOrAdmin } from "@/server/lib/requireProjectMember";

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

    return NextResponse.json({ task });
  } catch (error) {
    return jsonError(error);
  }
}
