"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Avatar } from "@/shared/ui";
import { fetchJsonSafe } from "@/features/admin/lib/client";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";
import type { AdminWorkspaceDetail } from "@/features/admin/types";

const ROLES = ["member", "leader", "admin"] as const;
const PLANS = ["free", "team", "business"] as const;

export function WorkspaceDetail({
  workspace,
}: {
  workspace: AdminWorkspaceDetail;
}) {
  const [plan, setPlan] = useState(workspace.subscription?.plan ?? "free");
  const [members, setMembers] = useState(workspace.memberships);
  const [locale] = useLocale();

  async function changePlan(newPlan: string) {
    const res = await fetchJsonSafe<{ subscription: { plan: string } }>(
      `/api/admin/workspaces/${workspace.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: newPlan }),
      }
    );
    if (!res) return;
    setPlan(newPlan);
    toast.success(t(locale, "admin.ws.planUpdated", { plan: newPlan }));
  }

  async function changeRole(memberId: string, role: string) {
    const res = await fetchJsonSafe<{ membership: { role: string } }>(
      `/api/admin/workspaces/${workspace.id}/members/${memberId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }
    );
    if (!res) return;
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role } : m))
    );
    toast.success(t(locale, "admin.ws.roleUpdated", { role }));
  }

  async function kick(memberId: string) {
    if (!confirm(t(locale, "admin.ws.kickConfirm"))) return;
    const ok = await fetchJsonSafe(
      `/api/admin/workspaces/${workspace.id}/members/${memberId}`,
      { method: "DELETE" }
    );
    if (!ok) return;
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast.success(t(locale, "admin.ws.kicked"));
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <Link
        href="/admin/workspaces"
        className="text-sm font-semibold text-ink-3 hover:text-ink"
      >
        {t(locale, "admin.ws.back")}
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-3xl">{workspace.emoji ?? "🚀"}</span>
        <div>
          <h1 className="font-display text-2xl text-ink">{workspace.name}</h1>
          <div className="text-[13px] text-ink-3">
            #{workspace.hashtag} · /{workspace.slug}
            {workspace.category ? ` · ${workspace.category}` : ""}
          </div>
        </div>
      </div>

      {workspace.description && (
        <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
          {workspace.description}
        </p>
      )}

      <div className="mt-6 rounded-[20px] border border-line bg-surface p-5">
        <h2 className="font-display text-[16px] text-ink">{t(locale, "admin.ws.subscriptionPlan")}</h2>
        <div className="mt-3 flex items-center gap-3">
          <select
            value={plan}
            onChange={(e) => changePlan(e.target.value)}
            className="rounded-full border border-line-2 bg-bg px-4 py-2 text-sm font-semibold text-ink outline-none focus:border-accent"
          >
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <span className="text-[13px] text-ink-3">
            {t(locale, "admin.ws.status")} {workspace.subscription?.status ?? "—"}
          </span>
        </div>
      </div>

      <div className="mt-6 rounded-[20px] border border-line bg-surface">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-[16px] text-ink">
            {t(locale, "admin.ws.members", { count: members.length })}
          </h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-2 text-[11px] uppercase tracking-[0.12em] text-ink-3">
            <tr>
              <th className="px-4 py-3">{t(locale, "admin.users.col.user")}</th>
              <th className="px-4 py-3">{t(locale, "admin.ws.col.role")}</th>
              <th className="px-4 py-3">{t(locale, "admin.ws.col.joined2")}</th>
              <th className="px-4 py-3 text-right">{t(locale, "admin.users.col.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar who={m.user.email ?? m.user.id} size={30} />
                    <div className="leading-tight">
                      <div className="font-semibold text-ink">
                        {m.user.name ?? "—"}
                      </div>
                      <div className="text-[12px] text-ink-3">{m.user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.id, e.target.value)}
                    className="rounded-full border border-line-2 bg-bg px-3 py-1 text-[12px] font-semibold text-ink outline-none focus:border-accent"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-ink-2">
                  {new Date(m.joinedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => kick(m.id)}
                    className="rounded-full bg-red-500/10 px-3 py-1 text-[12px] font-semibold text-red-400 hover:bg-red-500/20"
                  >
                    {t(locale, "admin.ws.kick")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
