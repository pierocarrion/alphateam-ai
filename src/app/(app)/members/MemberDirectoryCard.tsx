"use client";

import Link from "next/link";
import { cn } from "@/shared/lib/cn";
import { Avatar } from "@/shared/ui";
import { personIdFromName } from "@/shared/lib/person";
import { presenceFromUserId } from "@/shared/lib/presence";
import { StartDmButton } from "@/features/navigation/components/StartDmButton";

export interface DirectoryMember {
  id: string;
  name: string;
  role: string;
  projectRole: string | null;
  seniority: string;
  status: string;
  joinedAt: string;
  isYou: boolean;
  activeTasks: number;
  completedTasks: number;
  workedMinutes: number;
}

interface MemberDirectoryCardProps {
  member: DirectoryMember;
  workspaceId: string;
  isLeader: boolean;
  labels: {
    roleLabel: string;
    projectRole: string;
    seniority: string;
    responsibilities: string;
    workload: string;
    activeTasks: string;
    completedTasks: string;
    workedHours: string;
    viewProfile: string;
    assignTask: string;
    sendMessage: string;
    sendMessageHint: string;
    openDmError: string;
    joined: string;
    availability: string;
    availabilityState: string;
    youLabel: string;
  };
}

function workloadLevel(active: number): "light" | "moderate" | "heavy" {
  if (active >= 6) return "heavy";
  if (active >= 3) return "moderate";
  return "light";
}

const WORKLOAD_DOT: Record<"light" | "moderate" | "heavy", string> = {
  light: "#4ec27a",
  moderate: "#e6b73d",
  heavy: "#e6635a",
};

export function MemberDirectoryCard({
  member,
  workspaceId,
  isLeader,
  labels,
}: MemberDirectoryCardProps) {
  const presence = presenceFromUserId(member.id, member.status);
  const level = workloadLevel(member.activeTasks);
  const workedHours = Math.round((member.workedMinutes / 60) * 10) / 10;

  return (
    <div className="group relative flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-2">
      <Link
        href={`/profile/${member.id}`}
        className="flex items-start gap-3"
      >
        <Avatar
          who={personIdFromName(member.name)}
          size={44}
          status={presence}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-[15px] font-bold text-ink">
              {member.name}
            </span>
            {member.isYou && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-3">
                {labels.youLabel}
              </span>
            )}
          </div>
          {(member.projectRole || member.seniority) && (
            <div className="mt-0.5 truncate text-xs text-ink-3">
              {[member.projectRole, labels.seniority].filter(Boolean).join(" · ")}
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                member.role === "leader" || member.role === "admin"
                  ? "bg-accent-soft text-accent"
                  : "bg-surface-2 text-ink-3"
              )}
            >
              {labels.roleLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-ink-2">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: WORKLOAD_DOT[level] }}
              />
              {labels.availabilityState}
            </span>
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-3 gap-2">
        <MiniStat value={String(member.activeTasks)} label={labels.activeTasks} />
        <MiniStat value={String(member.completedTasks)} label={labels.completedTasks} />
        <MiniStat value={`${workedHours}h`} label={labels.workedHours} />
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <Link
          href={`/profile/${member.id}`}
          className="inline-flex items-center gap-1.5 rounded-button px-3 py-2 text-[13px] font-semibold text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-white/[0.03] hover:text-ink"
          title={labels.viewProfile}
        >
          {labels.viewProfile}
        </Link>
        {isLeader && (
          <Link
            href={`/tasks?assignee=${member.id}`}
            className="inline-flex items-center gap-1.5 rounded-button px-3 py-2 text-[13px] font-semibold text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-white/[0.03] hover:text-ink"
            title={labels.assignTask}
          >
            {labels.assignTask}
          </Link>
        )}
        {!member.isYou && (
          <StartDmButton
            partnerId={member.id}
            workspaceId={workspaceId}
            label={labels.sendMessage}
            errorLabel={labels.openDmError}
            variant="primary"
            size="sm"
            className="!px-3 !py-2 !text-[13px]"
          />
        )}
      </div>
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg-2 px-2 py-2 text-center">
      <div className="font-display text-[16px] font-bold text-ink">{value}</div>
      <div className="truncate text-[10px] uppercase tracking-wide text-ink-3">
        {label}
      </div>
    </div>
  );
}
