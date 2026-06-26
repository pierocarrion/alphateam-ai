import { NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";
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

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      hashtag: true,
      emoji: true,
      description: true,
      category: true,
      industry: true,
      createdAt: true,
      subscriptions: {
        take: 1,
        select: { plan: true, status: true, currentPeriodEnd: true },
      },
      memberships: {
        select: {
          id: true,
          role: true,
          projectRole: true,
          status: true,
          joinedAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { joinedAt: "desc" },
      },
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace no encontrado." }, { status: 404 });
  }
  return NextResponse.json({
    workspace: {
      ...workspace,
      subscription: workspace.subscriptions[0] ?? null,
      subscriptions: undefined,
    },
  });
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

  const exists = await prisma.workspace.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Workspace no encontrado." }, { status: 404 });
  }

  const sub = await prisma.workspaceSubscription.upsert({
    where: { workspaceId: id },
    create: { workspaceId: id, plan: body.plan, status: "active" },
    update: { plan: body.plan },
    select: { workspaceId: true, plan: true, status: true },
  });

  // Notify the workspace owner (leader/admin) that the plan changed.
  safeAfter(async () => {
    try {
      const [workspace, leader] = await Promise.all([
        prisma.workspace.findUnique({ where: { id }, select: { name: true } }),
        prisma.membership.findFirst({
          where: {
            workspaceId: id,
            role: { in: ["leader", "admin"] },
            status: "active",
          },
          orderBy: { joinedAt: "asc" },
          select: { userId: true },
        }),
      ]);
      if (leader) {
        await notifyUser({
          userId: leader.userId,
          type: "admin_action",
          title: "El plan de tu proyecto cambió",
          body: `Un administrador cambió el plan de ${
            workspace?.name ?? "tu proyecto"
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

  await prisma.workspace.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
