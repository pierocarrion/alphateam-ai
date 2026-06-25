import Link from "next/link";
import { prisma } from "@/server/lib/prisma";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/messages";

export const dynamic = "force-dynamic";

async function getMetrics() {
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
    prisma.workspaceSubscription.findMany({ select: { plan: true, status: true } }),
    prisma.membership.groupBy({ by: ["role"], _count: true }),
  ]);

  const planCounts: Record<string, number> = { free: 0, team: 0, business: 0 };
  for (const s of subscriptions) planCounts[s.plan] = (planCounts[s.plan] ?? 0) + 1;

  const planPrices: Record<string, number> = { free: 0, team: 15, business: 49 };
  const mrrEstimate = subscriptions.reduce((sum, s) => {
    if (s.status !== "active" && s.status !== "trialing") return sum;
    return sum + (planPrices[s.plan] ?? 0);
  }, 0);

  const memberships: Record<string, number> = {};
  for (const m of membershipsAgg) memberships[m.role] = m._count;

  return {
    totalUsers,
    blockedUsers,
    superAdmins,
    totalWorkspaces,
    alphaSessions,
    planCounts,
    mrrEstimate,
    memberships,
  };
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[20px] border p-5 ${
        accent ? "border-accent bg-accent-soft" : "border-line bg-surface"
      }`}
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
        {label}
      </div>
      <div className="mt-2 font-display text-[32px] text-ink">{value}</div>
      {hint && <div className="mt-1 text-[12px] text-ink-3">{hint}</div>}
    </div>
  );
}

export default async function AdminDashboard() {
  const m = await getMetrics();
  const locale = await getLocale();
  const roleLabel = (r: string) => t(locale, `admin.role.${r}`);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t(locale, "admin.users")} value={m.totalUsers} hint={t(locale, "admin.blockedCount", { count: m.blockedUsers })} />
        <StatCard label={t(locale, "admin.workspaces")} value={m.totalWorkspaces} />
        <StatCard label={t(locale, "admin.alphaSessions")} value={m.alphaSessions} />
        <StatCard label={t(locale, "admin.mrr")} value={`$${m.mrrEstimate}`} accent />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[20px] border border-line bg-surface p-5">
          <h2 className="font-display text-[16px] text-ink">{t(locale, "admin.planDistribution")}</h2>
          <div className="mt-4 space-y-2">
            {(["free", "team", "business"] as const).map((plan) => {
              const count = m.planCounts[plan] ?? 0;
              const pct = m.totalWorkspaces
                ? Math.round((count / m.totalWorkspaces) * 100)
                : 0;
              return (
                <div key={plan}>
                  <div className="flex justify-between text-[13px] text-ink-2">
                    <span className="uppercase">{plan}</span>
                    <span>
                      {count} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg-2">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[20px] border border-line bg-surface p-5">
          <h2 className="font-display text-[16px] text-ink">{t(locale, "admin.membershipsByRole")}</h2>
          <div className="mt-4 space-y-3">
            {(["member", "leader", "admin"] as const).map((role) => (
              <div key={role} className="flex justify-between text-[14px]">
                <span className="text-ink-2">{roleLabel(role)}</span>
                <span className="font-semibold text-ink">
                  {m.memberships[role] ?? 0}
                </span>
              </div>
            ))}
            <div className="border-t border-line pt-3 text-[13px] text-ink-3">
              {t(locale, "admin.activeSuperAdmins")} <b className="text-ink">{m.superAdmins}</b>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          href="/admin/users"
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
        >
          {t(locale, "admin.manageUsers")}
        </Link>
        <Link
          href="/admin/workspaces"
          className="rounded-full bg-surface px-5 py-2.5 text-sm font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-line-2)]"
        >
          {t(locale, "admin.manageWorkspaces")}
        </Link>
      </div>
    </div>
  );
}
