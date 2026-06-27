import { NextResponse } from "next/server";
import { db } from "@/server/lib/db";
import {
  workspace as workspaceTable,
  workspaceSubscription,
  membership,
  user,
} from "@drizzle/schema";
import { eq, and, inArray, desc, asc } from "drizzle-orm";
import { requireSuperAdmin } from "@/server/lib/requireSuperAdmin";
import { notifyUser, safeAfter } from "@/server/lib/notifications";

const ALLOWED_PLANS = new Set(["free", "team", "business"]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;

  const rows = await db.select({
    id: workspaceTable.id,
    name: workspaceTable.name,
    slug: workspaceTable.slug,
    hashtag: workspaceTable.hashtag,
    description: workspaceTable.description,
    category: workspaceTable.category,
    industry: workspaceTable.industry,
    createdAt: workspaceTable.createdAt,
    subPlan: workspaceSubscription.plan,
    subStatus: workspaceSubscription.status,
    subCurrentPeriodEnd: workspaceSubscription.currentPeriodEnd,
    membershipId: membership.id,
    membershipRole: membership.role,
    membershipProjectRole: membership.projectRole,
    membershipStatus: membership.status,
    membershipJoinedAt: membership.joinedAt,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
  })
    .from(workspaceTable)
    .leftJoin(workspaceSubscription, eq(workspaceSubscription.workspaceId, workspaceTable.id))
    .leftJoin(membership, eq(membership.workspaceId, workspaceTable.id))
    .leftJoin(user, eq(user.id, membership.userId))
    .where(eq(workspaceTable.id, id))
    .orderBy(desc(membership.joinedAt));

  if (rows.length === 0) {
    return NextResponse.json({ error: "Workspace no encontrado." }, { status: 404 });
  }

  const first = rows[0];
  const memberships = rows
    .filter((r) => r.membershipId !== null)
    .map((r) => ({
      id: r.membershipId,
      role: r.membershipRole,
      projectRole: r.membershipProjectRole,
      status: r.membershipStatus,
      joinedAt: r.membershipJoinedAt,
      user: { id: r.userId, name: r.userName, email: r.userEmail },
    }));
  const subscription =
    first.subPlan !== null || first.subStatus !== null || first.subCurrentPeriodEnd !== null
      ? {
          plan: first.subPlan,
          status: first.subStatus,
          currentPeriodEnd: first.subCurrentPeriodEnd,
        }
      : null;

  const workspace = {
    id: first.id,
    name: first.name,
    slug: first.slug,
    hashtag: first.hashtag,
    description: first.description,
    category: first.category,
    industry: first.industry,
    createdAt: first.createdAt,
    subscription,
    subscriptions: undefined,
    memberships,
  };

  return NextResponse.json({ workspace });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { plan?: string };

  if (!body.plan || !ALLOWED_PLANS.has(body.plan)) {
    return NextResponse.json(
      { error: "Plan inválido. Valores permitidos: free | team | business" },
      { status: 400 }
    );
  }

  const exists = await db.query.workspace.findFirst({
    where: eq(workspaceTable.id, id),
    columns: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Workspace no encontrado." }, { status: 404 });
  }

  const [sub] = await db.insert(workspaceSubscription)
    .values({ workspaceId: id, plan: body.plan, status: "active" })
    .onConflictDoUpdate({
      target: workspaceSubscription.workspaceId,
      set: { plan: body.plan },
    })
    .returning({
      workspaceId: workspaceSubscription.workspaceId,
      plan: workspaceSubscription.plan,
      status: workspaceSubscription.status,
    });

  // Notify the workspace owner (leader/admin) that the plan changed.
  safeAfter(async () => {
    try {
      const [ws, leader] = await Promise.all([
        db.query.workspace.findFirst({
          where: eq(workspaceTable.id, id),
          columns: { name: true },
        }),
        db.query.membership.findFirst({
          where: and(
            eq(membership.workspaceId, id),
            inArray(membership.role, ["leader", "admin"]),
            eq(membership.status, "active")
          ),
          orderBy: asc(membership.joinedAt),
          columns: { userId: true },
        }),
      ]);
      if (leader) {
        await notifyUser({
          userId: leader.userId,
          type: "admin_action",
          title: "El plan de tu proyecto cambió",
          body: `Un administrador cambió el plan de ${
            ws?.name ?? "tu proyecto"
          } a: ${body.plan}.`,
          data: { workspaceId: id, plan: body.plan },
          workspaceId: id,
          url: "/settings/billing",
        });
      }
    } catch {
      // best-effort
    }
  });

  return NextResponse.json({ subscription: sub });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;

  await db.delete(workspaceTable).where(eq(workspaceTable.id, id));
  return NextResponse.json({ ok: true });
}
