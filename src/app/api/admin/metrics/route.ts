import { NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { requireSuperAdmin } from "@/server/lib/requireSuperAdmin";

export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  const [
    totalUsers,
    blockedUsers,
    superAdmins,
    totalWorkspaces,
    alphaSessions,
    subscriptions,
    membershipsAgg,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { blocked: true } }),
    prisma.user.count({ where: { globalRole: "superadmin" } }),
    prisma.workspace.count(),
    prisma.alphaSession.count(),
    prisma.workspaceSubscription.findMany({
      select: { plan: true, status: true },
    }),
    prisma.membership.groupBy({
      by: ["role"],
      _count: true,
    }),
  ]);

  const planCounts = subscriptions.reduce<
    Record<string, number>
  >((acc, s) => {
    acc[s.plan] = (acc[s.plan] ?? 0) + 1;
    return acc;
  }, {});

  const planPrices: Record<string, number> = { free: 0, team: 15, business: 49 };
  const mrrEstimate = subscriptions.reduce((sum, s) => {
    if (s.status !== "active" && s.status !== "trialing") return sum;
    return sum + (planPrices[s.plan] ?? 0);
  }, 0);

  return NextResponse.json({
    totals: {
      users: totalUsers,
      blockedUsers,
      superAdmins,
      workspaces: totalWorkspaces,
      alphaSessions,
      mrrEstimate,
    },
    plans: {
      free: planCounts.free ?? 0,
      team: planCounts.team ?? 0,
      business: planCounts.business ?? 0,
    },
    memberships: Object.fromEntries(
      membershipsAgg.map((m) => [m.role, m._count])
    ),
  });
}
