import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { task, user as userTable, membership, auditLog } from "@drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";

const patchSchema = z
  .object({
    userId: z.string().min(1).optional(),
    load: z.enum(["Light", "Medium", "Heavy"]).optional(),
    snoozeHours: z.number().int().min(1).max(168).optional(),
    close: z.boolean().optional(),
  })
  .refine(
    (v) => v.userId !== undefined || v.load !== undefined || v.snoozeHours !== undefined || v.close !== undefined,
    { message: "Indica qué cambiar." }
  );

async function requireLeader() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return {
      error: NextResponse.json(
        { error: "Inicia sesión para continuar." },
        { status: 401 }
      ),
    };
  }
  const user = await db.query.user.findFirst({
    where: eq(userTable.email, session.user.email),
    columns: { id: true, name: true },
  });
  if (!user) {
    return {
      error: NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 }),
    };
  }
  const { active } = await getActiveWorkspace(user.id);
  if (!active || (active.role !== "leader" && active.role !== "admin")) {
    return {
      error: NextResponse.json(
        { error: "Exclusivo para líderes." },
        { status: 403 }
      ),
    };
  }
  return { user, active };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireLeader();
    if ("error" in auth) return auth.error;
    const { user, active } = auth;
    const { id } = await params;

    const [existing] = await db
      .select({
        id: task.id,
        title: task.title,
        category: task.category,
        app: task.app,
        load: task.load,
        status: task.status,
        createdAt: task.createdAt,
        userId: task.userId,
        userName: userTable.name,
      })
      .from(task)
      .leftJoin(userTable, eq(userTable.id, task.userId))
      .where(eq(task.id, id));
    const membershipRow = existing
      ? await db.query.membership.findFirst({
          where: and(
            eq(membership.userId, existing.userId),
            eq(membership.workspaceId, active.workspaceId)
          ),
          columns: { id: true },
        })
      : undefined;
    if (!existing || !membershipRow) {
      return NextResponse.json(
        { error: "No encontramos esa tarea en tu equipo." },
        { status: 404 }
      );
    }

    const parsed = patchSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const before = {
      ownerId: existing.userId,
      ownerName: existing.userName ?? "Someone",
      load: existing.load,
      status: existing.status,
    };

    const data: {
      userId?: string;
      load?: string;
      status?: string;
      completedAt?: Date | null;
    } = {};
    let action = "task.update";
    if (input.userId) {
      data.userId = input.userId;
      action = "task.reassign";
    }
    if (input.load) {
      data.load = input.load;
      action = "task.load_change";
    }
    if (input.snoozeHours) {
      // Snooze = keep open but push the deadline forward so it leaves the
      // "active" radar for a while. Implemented as a future deadline.
      const future = new Date(Date.now() + input.snoozeHours * 3600_000);
      await db
        .update(task)
        .set({ deadline: future })
        .where(eq(task.id, id));
      action = "task.snooze";
    }
    if (input.close) {
      data.status = "done";
      data.completedAt = new Date();
      action = "task.close";
    }

    let updated: {
      id: string;
      title: string;
      category: string;
      app: string;
      load: string;
      status: string;
      createdAt: Date;
      userId: string;
    } = existing;
    if (Object.keys(data).length > 0) {
      const [row] = await db
        .update(task)
        .set(data)
        .where(eq(task.id, id))
        .returning();
      updated = row!;
    }

    const after = {
      ownerId: updated.userId,
      load: updated.load,
      status: updated.status,
    };

    await db.insert(auditLog).values({
      workspaceId: active.workspaceId,
      actorId: user.id,
      action,
      entity: "task",
      entityId: id,
      before: JSON.stringify(before),
      after: JSON.stringify(after),
    });

    return NextResponse.json({
      task: {
        id: updated.id,
        title: updated.title,
        category: updated.category,
        app: updated.app,
        load: updated.load,
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
        ownerId: updated.userId,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
