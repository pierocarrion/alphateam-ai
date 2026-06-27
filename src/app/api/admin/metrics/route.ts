import { NextResponse } from "next/server";
import { db } from "@/server/lib/db";
import {
  user,
  workspace,
  alphaSession,
  workspaceSubscription,
  membership,
} from "@drizzle/schema";
import { eq, count } from "drizzle-orm";
import { requireSuperAdmin } from "@/server/lib/requireSuperAdmin";

export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.response) return auth.response;

  const [
    totalUsersAgg,
    blockedUsersAgg,
    superAdminsAgg,
    totalWorkspacesAgg,
    alphaSessionsAgg,
    subscriptions,
    membershipsAgg,
  ] = await Promise.all([
    db.select({ c: count() }).from(user),
    db.select({ c: count() }).from(user).where(eq(user.blocked, true)),
    db.select({ c: count() }).from(user).where(eq(user.globalRole, "superadmin")),
    db.select({ c: count() }).from(workspace),
    db.select({ c: count() }).from(alphaSession),
    db.select({
      plan: workspaceSubscription.plan,
      status: workspaceSubscription.status,
    }).from(workspaceSubscription),
    db.select({ role: membership.role, c: count() }).from(membership).groupBy(membership.role),
  ]);

  const totalUsers = Number(totalUsersAgg[0]?.c ?? 0);
  const blockedUsers = Number(blockedUsersAgg[0]?.c ?? 0);
  const superAdmins = Number(superAdminsAgg[0]?.c ?? 0);
  const totalWorkspaces = Number(totalWorkspacesAgg[0]?.c ?? 0);
  const alphaSessions = Number(alphaSessionsAgg[0]?.c ?? 0);

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
      membershipsAgg.map((m) => [m.role, Number(m.c)])
    ),
  });
}
