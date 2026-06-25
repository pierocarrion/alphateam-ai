"use client";

import { useState } from "react";
import Link from "next/link";
import { fetchJsonSafe } from "@/features/admin/lib/client";
import type { AdminWorkspace } from "@/features/admin/types";

const PLANS = ["free", "team", "business"] as const;

export function WorkspacesTable({ initial }: { initial: AdminWorkspace[] }) {
  const [rows, setRows] = useState(initial);

  async function changePlan(id: string, plan: string) {
    const res = await fetchJsonSafe<{ subscription: { plan: string } }>(
      `/api/admin/workspaces/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      }
    );
    if (!res) return;
    setRows((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, subscription: { plan, status: w.subscription?.status ?? "active" } }
          : w
      )
    );
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este workspace y todos sus datos?")) return;
    const ok = await fetchJsonSafe(`/api/admin/workspaces/${id}`, { method: "DELETE" });
    if (!ok) return;
    setRows((prev) => prev.filter((w) => w.id !== id));
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <div className="overflow-hidden rounded-[20px] border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-2 text-[11px] uppercase tracking-[0.12em] text-ink-3">
            <tr>
              <th className="px-4 py-3">Workspace</th>
              <th className="px-4 py-3">Miembros</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Alta</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-3">
                  Sin workspaces.
                </td>
              </tr>
            )}
            {rows.map((w) => (
              <tr key={w.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/workspaces/${w.id}`}
                    className="flex items-center gap-2 font-semibold text-ink hover:text-accent"
                  >
                    <span className="text-lg">{w.emoji ?? "🚀"}</span>
                    <span>
                      {w.name}
                      <span className="ml-2 text-[12px] font-normal text-ink-3">
                        #{w.hashtag}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-2">{w._count.memberships}</td>
                <td className="px-4 py-3">
                  <select
                    value={w.subscription?.plan ?? "free"}
                    onChange={(e) => changePlan(w.id, e.target.value)}
                    className="rounded-full border border-line-2 bg-bg px-3 py-1 text-[12px] font-semibold text-ink outline-none focus:border-accent"
                  >
                    {PLANS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-ink-2">
                  {new Date(w.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <Link
                      href={`/admin/workspaces/${w.id}`}
                      className="rounded-full bg-transparent px-3 py-1 text-[12px] font-semibold text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-2)] hover:text-ink"
                    >
                      Ver
                    </Link>
                    <button
                      onClick={() => remove(w.id)}
                      className="rounded-full bg-red-500/10 px-3 py-1 text-[12px] font-semibold text-red-400 hover:bg-red-500/20"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
