"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/shared/ui";
import { PROJECT_ROLES, isLeadershipRole, roleName } from "@/features/project-settings/domain/catalog";
import type { ProjectInvitation, ProjectMember } from "@/features/project-settings/domain/entities";
import {
  useInviteMember,
  useRemoveMember,
  useUpdateMember,
} from "../hooks";
import { Modal, SectionHeader, EmptyState } from "./primitives";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";

interface Props {
  workspaceId: string;
  members: ProjectMember[];
  invitations: ProjectInvitation[];
}

export function TeamManager({ workspaceId, members, invitations }: Props) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<ProjectMember | null>(null);

  const inviteMutation = useInviteMember(workspaceId);
  const updateMutation = useUpdateMember(workspaceId);
  const removeMutation = useRemoveMember(workspaceId);
  const [locale] = useLocale();

  const sendInvite = async () => {
    if (!email.trim()) return;
    try {
      await inviteMutation.mutateAsync({ email: email.trim(), projectRole: role });
      toast.success(t(locale, "ps.team.inviteSent", { email }));
      setEmail("");
      setRole(null);
      setInviteOpen(false);
    } catch {
      /* handled by provider */
    }
  };

  const changeRole = async (member: ProjectMember, projectRole: string | null) => {
    try {
      await updateMutation.mutateAsync({ memberId: member.id, body: { projectRole } });
      toast.success(t(locale, "ps.team.roleUpdated"));
    } catch {
      /* handled */
    }
  };

  const changeStatus = async (member: ProjectMember, status: "active" | "inactive") => {
    try {
      await updateMutation.mutateAsync({ memberId: member.id, body: { status } });
      toast.success(status === "active" ? t(locale, "ps.team.reactivated") : t(locale, "ps.team.deactivated"));
    } catch {
      /* handled */
    }
  };

  const confirmRemoveMember = async () => {
    if (!confirmRemove) return;
    try {
      await removeMutation.mutateAsync(confirmRemove.id);
      toast.success(t(locale, "ps.team.removed"));
      setConfirmRemove(null);
    } catch {
      /* handled */
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <SectionHeader
          title={t(locale, "ps.team.title")}
          description={t(locale, "ps.team.desc")}
        />
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="rounded-button bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
        >
          {t(locale, "ps.team.invite")}
        </button>
      </div>

      {members.length === 0 && invitations.length === 0 ? (
        <EmptyState title={t(locale, "ps.team.emptyTitle")} hint={t(locale, "ps.team.emptyHint")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-ink-3">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 font-bold">{t(locale, "ps.team.col.member")}</th>
                <th className="py-2 pr-3 font-bold">{t(locale, "ps.team.col.role")}</th>
                <th className="py-2 pr-3 font-bold">{t(locale, "ps.team.col.status")}</th>
                <th className="py-2 pr-3 font-bold">{t(locale, "ps.team.col.joined")}</th>
                <th className="py-2 font-bold text-right">{t(locale, "ps.team.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const leader = m.permissionRole === "leader" || m.permissionRole === "admin";
                return (
                  <tr key={m.id} className="border-b border-line/60 align-middle">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-ink">{m.name ?? "—"}</div>
                      <div className="text-[12px] text-ink-3">{m.email ?? "—"}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={m.projectRole ?? ""}
                        onChange={(e) => changeRole(m, e.target.value || null)}
                        className="max-w-[170px] rounded-xl border border-line-2 bg-surface px-2 py-1.5 text-[13px] text-ink outline-none focus:border-accent"
                      >
                        <option value="">{t(locale, "ps.team.noRole")}</option>
                        {PROJECT_ROLES.map((r) => (
                          <option key={r.key} value={r.key}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      {leader && (
                        <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
                          {m.permissionRole.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={
                          m.status === "active"
                            ? "rounded-full bg-sage-soft px-2 py-0.5 text-[11px] font-semibold text-sage"
                            : m.status === "inactive"
                            ? "rounded-full bg-glow-soft px-2 py-0.5 text-[11px] font-semibold text-glow"
                            : "rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-ink-2"
                        }
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-[12.5px] text-ink-3">
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            changeStatus(m, m.status === "active" ? "inactive" : "active")
                          }
                          className="rounded-lg border border-line px-2 py-1 text-[11px] text-ink-2 hover:bg-surface-2"
                        >
                          {m.status === "active" ? t(locale, "ps.team.deactivate") : t(locale, "ps.team.reactivate")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(m)}
                          className="rounded-lg border border-line px-2 py-1 text-[11px] text-glow hover:bg-surface-2"
                        >
                          {t(locale, "common.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {invitations.map((inv) => (
                <tr key={inv.id} className="border-b border-line/60 align-middle opacity-80">
                  <td className="py-3 pr-3">
                    <div className="font-semibold text-ink-2">{inv.email}</div>
                    <div className="text-[12px] text-ink-3">{t(locale, "ps.team.invitePending")}</div>
                  </td>
                  <td className="py-3 pr-3 text-[13px] text-ink-2">
                    {roleName(inv.projectRole)}
                  </td>
                  <td className="py-3 pr-3">
                    <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
                      {t(locale, "ps.team.invited")}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-[12.5px] text-ink-3">—</td>
                  <td className="py-3 text-right text-[11px] text-ink-3">{t(locale, "ps.team.waiting")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11.5px] text-ink-3">
        {t(locale, "ps.team.leadershipNote", { roles: PROJECT_ROLES.filter((r) => r.isLeadership).map((r) => r.name).join(", ") })}
      </p>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title={t(locale, "ps.team.inviteTitle")}>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-ink-3">
              {t(locale, "ps.team.email")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="persona@empresa.com"
              className="mt-1 w-full rounded-2xl border border-line-2 bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-ink-3">
              {t(locale, "ps.team.projectRole")}
            </label>
            <select
              value={role ?? ""}
              onChange={(e) => setRole(e.target.value || null)}
              className="mt-1 w-full rounded-2xl border border-line-2 bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
            >
              <option value="">{t(locale, "ps.team.noRole")}</option>
              {PROJECT_ROLES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                  {r.isLeadership ? t(locale, "ps.team.leadershipSuffix") : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={sendInvite}
            disabled={!email.trim() || inviteMutation.isPending}
            className="mt-2 rounded-button bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-50"
          >
            {inviteMutation.isPending ? t(locale, "ps.team.sending") : t(locale, "ps.team.sendInvite")}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title={t(locale, "ps.team.removeTitle")}
      >
        <p className="text-sm text-ink-2">
          {t(locale, "ps.team.removeConfirm", { name: confirmRemove?.name ?? "" })}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmRemove(null)}
            className="rounded-button border border-line px-4 py-2 text-sm text-ink-2"
          >
            {t(locale, "common.cancel")}
          </button>
          <button
            type="button"
            onClick={confirmRemoveMember}
            disabled={removeMutation.isPending}
            className="rounded-button bg-glow px-4 py-2 text-sm font-semibold text-bg"
          >
            {removeMutation.isPending ? t(locale, "ps.team.removing") : t(locale, "common.delete")}
          </button>
        </div>
      </Modal>
    </Card>
  );
}

void isLeadershipRole;
