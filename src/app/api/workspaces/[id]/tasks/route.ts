import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/lib/prisma";
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

    const tasks = await prisma.projectTask.findMany({
      where: { workspaceId: auth.workspaceId },
      include: {
        assignee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

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
      const assigneeMember = await prisma.membership.findUnique({
        where: {
          userId_workspaceId: { userId: assigneeId, workspaceId: auth.workspaceId },
        },
        select: { status: true },
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

    const task = await prisma.projectTask.create({
      data: {
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
      },
      include: {
        assignee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
