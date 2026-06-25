import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { computeLoadBalance } from "@/server/lib/metrics";
import { jsonError } from "@/server/lib/apiErrors";

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

/** GET: live load balance + open tasks assignable to this workspace's members. */
export async function GET() {
  try {
    const auth = await requireLeader();
    if ("error" in auth) return auth.error;
    const { active } = auth;

    const [tasks, load, members] = await Promise.all([
      prisma.task.findMany({
        where: {
          status: "open",
          user: { memberships: { some: { workspaceId: active.workspaceId } } },
        },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      computeLoadBalance(active.workspaceId),
      prisma.membership.findMany({
        where: { workspaceId: active.workspaceId },
        select: {
          user: { select: { id: true, name: true } },
          role: true,
        },
        orderBy: { joinedAt: "asc" },
      }),
    ]);

    return NextResponse.json({
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        app: t.app,
        load: t.load,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        ownerId: t.userId,
        ownerName: t.user.name ?? "Someone",
      })),
      loadBalance: load,
      members: members.map((m) => ({
        id: m.user.id,
        name: m.user.name ?? "Someone",
        role: m.role,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
