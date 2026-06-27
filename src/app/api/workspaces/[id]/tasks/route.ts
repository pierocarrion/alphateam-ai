import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, asc, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/server/lib/db";
import { projectTask, membership, user } from "@drizzle/schema";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { requireProjectMember, isLeaderOrAdmin } from "@/server/lib/requireProjectMember";

const STATUSES = ["todo", "doing", "done"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).nullable().optional(),
  dueDate: z.union([z.string(), z.date()]).nullable().optional(),
  tags: z.array(z.string()).optional(),
  assigneeId: z.string().nullable().optional(),
  phaseKey: z.string().max(120).nullable().optional(),
  artifactKey: z.string().max(120).nullable().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireProjectMember((await params).id);
    if (auth.response) return auth.response;

    const assignee = alias(user, "assignee");
    const creator = alias(user, "creator");
    const rows = await db.select({
      id: projectTask.id,
      workspaceId: projectTask.workspaceId,
      assigneeId: projectTask.assigneeId,
      createdById: projectTask.createdById,
      title: projectTask.title,
      description: projectTask.description,
      status: projectTask.status,
      priority: projectTask.priority,
      dueDate: projectTask.dueDate,
      tags: projectTask.tags,
      order: projectTask.order,
      phaseKey: projectTask.phaseKey,
      artifactKey: projectTask.artifactKey,
      createdAt: projectTask.createdAt,
      updatedAt: projectTask.updatedAt,
      completedAt: projectTask.completedAt,
      assigneeUserId: assignee.id,
      assigneeName: assignee.name,
      creatorName: creator.name,
    })
      .from(projectTask)
      .leftJoin(assignee, eq(assignee.id, projectTask.assigneeId))
      .leftJoin(creator, eq(creator.id, projectTask.createdById))
      .where(eq(projectTask.workspaceId, auth.workspaceId))
      .orderBy(asc(projectTask.order), desc(projectTask.createdAt));

    const tasks = rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      assigneeId: r.assigneeId,
      createdById: r.createdById,
      title: r.title,
      description: r.description,
      status: r.status,
      priority: r.priority,
      dueDate: r.dueDate,
      tags: r.tags,
      order: r.order,
      phaseKey: r.phaseKey,
      artifactKey: r.artifactKey,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      completedAt: r.completedAt,
      assignee: r.assigneeUserId
        ? { id: r.assigneeUserId, name: r.assigneeName }
        : null,
      createdBy: { id: r.createdById, name: r.creatorName },
    }));

    return NextResponse.json({ tasks });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireProjectMember((await params).id);
    if (auth.response) return auth.response;

    const parsed = createSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }

    const { title, description, status, priority, dueDate, tags, assigneeId, phaseKey, artifactKey } = parsed.data;
    const leader = isLeaderOrAdmin(auth.role);

    // Members can only assign to themselves; leaders/admins can assign to anyone.
    let resolvedAssigneeId: string | null = null;
    if (assigneeId) {
      if (!leader && assigneeId !== auth.user.id) {
        return NextResponse.json(
          { error: "Solo el líder puede asignar tareas a otras personas." },
          { status: 403 }
        );
      }
      // Verify the assignee is an active member of the workspace.
      const assigneeMember = await db.query.membership.findFirst({
        where: and(
          eq(membership.userId, assigneeId),
          eq(membership.workspaceId, auth.workspaceId)
        ),
        columns: { status: true },
      });
      if (!assigneeMember || assigneeMember.status !== "active") {
        return NextResponse.json(
          { error: "Esa persona no es miembro activo del proyecto." },
          { status: 400 }
        );
      }
      resolvedAssigneeId = assigneeId;
    } else if (!leader) {
      // Members default to self-assignment.
      resolvedAssigneeId = auth.user.id;
    }

    const [created] = await db.insert(projectTask).values({
      workspaceId: auth.workspaceId,
      createdById: auth.user.id,
      assigneeId: resolvedAssigneeId,
      title: title.trim(),
      description: description?.trim() || null,
      status: status ?? "todo",
      priority: priority ?? null,
      dueDate: dueDate ? new Date(dueDate) : null,
      tags: tags ?? [],
      phaseKey: phaseKey ?? null,
      artifactKey: artifactKey ?? null,
      completedAt: status === "done" ? new Date() : null,
    }).returning();

    const [assigneeUser, creatorUser] = await Promise.all([
      created.assigneeId
        ? db.query.user.findFirst({
            where: eq(user.id, created.assigneeId),
            columns: { id: true, name: true },
          })
        : Promise.resolve(null),
      db.query.user.findFirst({
        where: eq(user.id, created.createdById),
        columns: { id: true, name: true },
      }),
    ]);

    const task = { ...created, assignee: assigneeUser, createdBy: creatorUser };

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
