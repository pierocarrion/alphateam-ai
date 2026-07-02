import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/lib/db";
import { projectTask, user } from "@drizzle/schema";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { requireProjectMember, isLeaderOrAdmin } from "@/server/lib/requireProjectMember";

const STATUSES = ["todo", "doing", "done"] as const;

const updateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(STATUSES).optional(),
  order: z.number().int().finite().min(-1_000_000).max(1_000_000),
});

const reorderSchema = z.object({
  updates: z.array(updateSchema).min(1).max(200),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireProjectMember((await params).id);
    if (auth.response) return auth.response;

    const parsed = reorderSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }

    const leader = isLeaderOrAdmin(auth.role);

    // Dedupe by id (last entry wins) so a card can't be patched twice.
    const byId = new Map<
      string,
      { id: string; status?: (typeof STATUSES)[number]; order: number }
    >();
    for (const u of parsed.data.updates) byId.set(u.id, u);
    const updates = Array.from(byId.values());
    const ids = updates.map((u) => u.id);

    const rows = await db.query.projectTask.findMany({
      where: inArray(projectTask.id, ids),
      columns: {
        id: true,
        workspaceId: true,
        assigneeId: true,
        createdById: true,
        status: true,
      },
    });
    const existingById = new Map(rows.map((r) => [r.id, r]));

    // Every referenced task must exist and belong to this workspace.
    for (const u of updates) {
      const ex = existingById.get(u.id);
      if (!ex || ex.workspaceId !== auth.workspaceId) {
        return NextResponse.json(
          { error: "No encontramos esa tarea." },
          { status: 404 }
        );
      }
    }

    // Permission per task: leader/admin OR the assignee OR the creator.
    for (const u of updates) {
      const ex = existingById.get(u.id)!;
      const isAssignee = ex.assigneeId === auth.user.id;
      const isCreator = ex.createdById === auth.user.id;
      if (!leader && !isAssignee && !isCreator) {
        return NextResponse.json(
          {
            error:
              "Solo el asignado, el creador o el líder pueden mover esta tarea.",
          },
          { status: 403 }
        );
      }
    }

    const updated = await db.transaction(async (tx) => {
      const out: (typeof projectTask.$inferSelect)[] = [];
      for (const u of updates) {
        const ex = existingById.get(u.id)!;
        const wasDone = ex.status === "done";
        const nextStatus = u.status ?? ex.status;
        const nowDone = nextStatus === "done";
        const [row] = await tx
          .update(projectTask)
          .set({
            ...(u.status !== undefined ? { status: u.status } : {}),
            order: u.order,
            ...(!wasDone && nowDone ? { completedAt: new Date() } : {}),
            ...(wasDone && nextStatus !== "done" ? { completedAt: null } : {}),
          })
          .where(eq(projectTask.id, u.id))
          .returning();
        if (row) out.push(row);
      }
      return out;
    });

    const tasks = await Promise.all(
      updated.map(async (r) => {
        const [assigneeUser, creatorUser] = await Promise.all([
          r.assigneeId
            ? db.query.user.findFirst({
                where: eq(user.id, r.assigneeId),
                columns: { id: true, name: true },
              })
            : Promise.resolve(null),
          db.query.user.findFirst({
            where: eq(user.id, r.createdById),
            columns: { id: true, name: true },
          }),
        ]);
        return { ...r, assignee: assigneeUser, createdBy: creatorUser };
      })
    );

    return NextResponse.json({ tasks });
  } catch (error) {
    return jsonError(error);
  }
}
