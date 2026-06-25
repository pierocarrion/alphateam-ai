import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
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
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true },
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

    const existing = await prisma.task.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true } } },
    });
    if (
      !existing ||
      !(await prisma.membership.findUnique({
        where: {
          userId_workspaceId: {
            userId: existing.userId,
            workspaceId: active.workspaceId,
          },
        },
        select: { id: true },
      }))
    ) {
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
      ownerName: existing.user.name ?? "Someone",
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
      await prisma.task.update({
        where: { id },
        data: { deadline: future },
      });
      action = "task.snooze";
    }
    if (input.close) {
      data.status = "done";
      data.completedAt = new Date();
      action = "task.close";
    }

    const updated =
      Object.keys(data).length > 0
        ? await prisma.task.update({ where: { id }, data })
        : existing;

    const after = {
      ownerId: updated.userId,
      load: updated.load,
      status: updated.status,
    };

    await prisma.auditLog.create({
      data: {
        workspaceId: active.workspaceId,
        actorId: user.id,
        action,
        entity: "task",
        entityId: id,
        before: JSON.stringify(before),
        after: JSON.stringify(after),
      },
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
