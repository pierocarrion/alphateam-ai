import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { task, user as userTable, membership } from "@drizzle/schema";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
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

/** GET: live load balance + open tasks assignable to this workspace's members. */
export async function GET() {
  try {
    const auth = await requireLeader();
    if ("error" in auth) return auth.error;
    const { active } = auth;

    const wsMembers = await db
      .select({ userId: membership.userId })
      .from(membership)
      .where(eq(membership.workspaceId, active.workspaceId));
    const memberIds = wsMembers.map((m) => m.userId);

    const [taskRows, load, members] = await Promise.all([
      memberIds.length
        ? db
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
            .where(
              and(eq(task.status, "open"), inArray(task.userId, memberIds))
            )
            .orderBy(desc(task.createdAt))
        : Promise.resolve([]),
      computeLoadBalance(active.workspaceId),
      db
        .select({
          userId: membership.userId,
          userName: userTable.name,
          role: membership.role,
        })
        .from(membership)
        .leftJoin(userTable, eq(userTable.id, membership.userId))
        .where(eq(membership.workspaceId, active.workspaceId))
        .orderBy(asc(membership.joinedAt)),
    ]);

    return NextResponse.json({
      tasks: taskRows.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        app: t.app,
        load: t.load,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        ownerId: t.userId,
        ownerName: t.userName ?? "Someone",
      })),
      loadBalance: load,
      members: members.map((m) => ({
        id: m.userId,
        name: m.userName ?? "Someone",
        role: m.role,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
