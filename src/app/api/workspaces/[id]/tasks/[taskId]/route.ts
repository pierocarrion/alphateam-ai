import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/server/lib/db";
import { projectTask, user } from "@drizzle/schema";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { requireProjectMember, isLeaderOrAdmin } from "@/server/lib/requireProjectMember";

const STATUSES = ["todo", "doing", "done"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).nullable().optional(),
  dueDate: z.union([z.string(), z.date()]).nullable().optional(),
  tags: z.array(z.string()).optional(),
  order: z.number().int().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: rawProjectId, taskId } = await params;
    const auth = await requireProjectMember(rawProjectId);
    if (auth.response) return auth.response;

    const parsed = patchSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }

    const existing = await db.query.projectTask.findFirst({
      where: eq(projectTask.id, taskId),
      columns: { workspaceId: true, assigneeId: true, createdById: true, status: true },
    });
    if (!existing || existing.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "No encontramos esa tarea." }, { status: 404 });
    }

    const leader = isLeaderOrAdmin(auth.role);
    const isAssignee = existing.assigneeId === auth.user.id;
    const isCreator = existing.createdById === auth.user.id;
    if (!leader && !isAssignee && !isCreator) {
      return NextResponse.json(
        { error: "Solo el asignado, el creador o el líder pueden editar esta tarea." },
        { status: 403 }
      );
    }

    const data = parsed.data;
    const wasDone = existing.status === "done";
    const nowDone = data.status === "done";

    const [updated] = await db.update(projectTask).set({
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
      ...(data.order !== undefined ? { order: data.order } : {}),
      ...(!wasDone && nowDone ? { completedAt: new Date() } : {}),
      ...(wasDone && data.status && data.status !== "done" ? { completedAt: null } : {}),
    }).where(eq(projectTask.id, taskId)).returning();

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

    return NextResponse.json({ task });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: rawProjectId, taskId } = await params;
    const auth = await requireProjectMember(rawProjectId);
    if (auth.response) return auth.response;

    const existing = await db.query.projectTask.findFirst({
      where: eq(projectTask.id, taskId),
      columns: { workspaceId: true, assigneeId: true, createdById: true },
    });
    if (!existing || existing.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "No encontramos esa tarea." }, { status: 404 });
    }

    const leader = isLeaderOrAdmin(auth.role);
    const isAssignee = existing.assigneeId === auth.user.id;
    const isCreator = existing.createdById === auth.user.id;
    if (!leader && !isAssignee && !isCreator) {
      return NextResponse.json(
        { error: "Solo el asignado, el creador o el líder pueden eliminar esta tarea." },
        { status: 403 }
      );
    }

    await db.delete(projectTask).where(eq(projectTask.id, taskId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
