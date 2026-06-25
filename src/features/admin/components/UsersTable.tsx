"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/shared/ui";
import { fetchJsonSafe } from "@/features/admin/lib/client";
import type { AdminUser } from "@/features/admin/types";

export function UsersTable({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "blocked" | "active" | "superadmin">("all");

  async function refresh() {
    const qs = new URLSearchParams();
    if (query) qs.set("q", query);
    if (filter !== "all") qs.set("status", filter);
    const data = await fetchJsonSafe<{ users: AdminUser[] }>(
      `/api/admin/users?${qs.toString()}`
    );
    if (data) setUsers(data.users);
  }

  async function act(id: string, action: "block" | "unblock" | "promote" | "demote") {
    const res = await fetchJsonSafe<{ user: AdminUser }>(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res) return;
    toast.success(`Acción "${action}" aplicada.`);
    await refresh();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este usuario permanentemente? Esta acción no se puede deshacer.")) return;
    const ok = await fetchJsonSafe(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!ok) return;
    toast.success("Usuario eliminado.");
    await refresh();
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && refresh()}
          placeholder="Buscar por email…"
          className="min-w-[220px] flex-1 rounded-full border border-line-2 bg-surface px-4 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="rounded-full border border-line-2 bg-surface px-4 py-2 text-sm text-ink outline-none focus:border-accent"
        >
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="blocked">Bloqueados</option>
          <option value="superadmin">Super-admin</option>
        </select>
        <button
          onClick={refresh}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-ink"
        >
          Buscar
        </button>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-2 text-[11px] uppercase tracking-[0.12em] text-ink-3">
            <tr>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Alta</th>
              <th className="px-4 py-3">Workspaces</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-3">
                  Sin resultados.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar who={u.email ?? u.id} size={32} />
                    <div className="leading-tight">
                      <div className="font-semibold text-ink">{u.name ?? "—"}</div>
                      <div className="text-[12px] text-ink-3">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-2">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-ink-2">{u._count.memberships}</td>
                <td className="px-4 py-3">
                  {u.globalRole === "superadmin" ? (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold uppercase text-accent">
                      Super-admin
                    </span>
                  ) : u.blocked ? (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-bold uppercase text-red-400">
                      Bloqueado
                    </span>
                  ) : (
                    <span className="rounded-full bg-sage/15 px-2 py-0.5 text-[11px] font-bold uppercase text-sage">
                      Activo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {u.blocked ? (
                      <Btn onClick={() => act(u.id, "unblock")} label="Desbloquear" />
                    ) : (
                      <Btn onClick={() => act(u.id, "block")} label="Bloquear" ghost />
                    )}
                    {u.globalRole === "superadmin" ? (
                      <Btn onClick={() => act(u.id, "demote")} label="Quitar admin" ghost />
                    ) : (
                      <Btn onClick={() => act(u.id, "promote")} label="Hacer admin" ghost />
                    )}
                    <Btn onClick={() => remove(u.id)} label="Eliminar" danger />
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

function Btn({
  onClick,
  label,
  ghost,
  danger,
}: {
  onClick: () => void;
  label: string;
  ghost?: boolean;
  danger?: boolean;
}) {
  const cls = danger
    ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
    : ghost
      ? "bg-transparent text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line-2)] hover:text-ink"
      : "bg-accent text-accent-ink";
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[12px] font-semibold ${cls}`}
    >
      {label}
    </button>
  );
}
