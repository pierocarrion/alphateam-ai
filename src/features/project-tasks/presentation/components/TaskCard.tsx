"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { Avatar, Icon } from "@/shared/ui";
import { personIdFromName } from "@/shared/lib/person";
import type { PersonId } from "@/shared/ui";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";
import {
  PRIORITY_COLORS,
  PRIORITY_KEYS,
  type ProjectMemberOption,
  type ProjectTask,
  type ProjectTaskStatus,
} from "../types";
import { TaskAssignDialog } from "./TaskAssignDialog";
import { TaskEditDialog } from "./TaskEditDialog";

interface TaskCardProps {
  task: ProjectTask;
  status: ProjectTaskStatus;
  members: ProjectMemberOption[];
  currentUserId: string;
  isLeader: boolean;
  onMove: (taskId: string, status: ProjectTaskStatus) => void;
  onAssign: (taskId: string, assigneeId: string | null) => void;
  onDelete: (taskId: string) => void;
}

export function TaskCard({
  task,
  status,
  members,
  currentUserId,
  isLeader,
  onMove,
  onAssign,
  onDelete,
}: TaskCardProps) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [locale] = useLocale();

  const assignee = task.assignee;
  const isAssignee = task.assigneeId === currentUserId;
  const isCreator = task.createdById === currentUserId;
  const canEdit = isLeader || isAssignee || isCreator;

  const due = task.dueDate ? new Date(task.dueDate) : null;

  const columns: ProjectTaskStatus[] = ["todo", "doing", "done"];
  const otherStatuses = columns.filter((s) => s !== status);

  return (
    <>
      <div className="group rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-line-2">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="text-[14.5px] font-semibold leading-snug text-ink">
              {task.title}
            </p>
            {task.description && (
              <p className="mt-1 line-clamp-2 text-[12.5px] text-ink-3">
                {task.description}
              </p>
            )}
          </button>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-md p-1 text-ink-3 opacity-0 transition-opacity hover:bg-surface-2 hover:text-ink group-hover:opacity-100"
            aria-label={t(locale, "tasks.more")}
          >
            <Icon name="chevron" size={16} color="currentColor" />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-7 z-20 w-40 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg">
                {otherStatuses.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onMove(task.id, s);
                    }}
                    className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium text-ink-2 hover:bg-surface-2"
                  >
                    {t(locale, "tasks.moveTo", { label: columnLabel(locale, s) })}
                  </button>
                ))}
                {canEdit && (
                  <>
                    <div className="my-1 border-t border-line" />
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setEditOpen(true);
                      }}
                      className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium text-ink-2 hover:bg-surface-2"
                    >
                      {t(locale, "common.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        if (confirm(t(locale, "tasks.deleteConfirm"))) onDelete(task.id);
                      }}
                      className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium text-glow hover:bg-surface-2"
                    >
                      {t(locale, "common.delete")}
                    </button>
                  </>
                )}
                </div>
              </>
            )}
          </div>
        </div>

        {(task.priority || due || task.tags.length > 0) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {task.priority && (
              <span
                className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide"
                style={{ color: PRIORITY_COLORS[task.priority] }}
              >
                {t(locale, PRIORITY_KEYS[task.priority])}
              </span>
            )}
            {due && (
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-semibold",
                  "text-ink-3"
                )}
              >
                <Icon name="clock" size={11} color="currentColor" />
                {due.toLocaleDateString(locale, { day: "numeric", month: "short" })}
              </span>
            )}
            {task.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-medium text-ink-3"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          {assignee ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <Avatar
                who={personIdFromName(assignee.name ?? "someone") as PersonId}
                size={22}
              />
              <span className="truncate text-[12px] font-semibold text-ink-2">
                {assignee.name?.split(" ")[0] ?? "Someone"}
                {isAssignee && (
                  <span className="ml-1 text-[10px] font-bold uppercase text-ink-3">
                    {t(locale, "tasks.you")}
                  </span>
                )}
              </span>
            </div>
          ) : (
            <span
              className="rounded-full border border-dashed border-line-2 px-2 py-0.5 text-[11px] font-semibold text-ink-3"
            >
              {t(locale, "tasks.unassigned")}
            </span>
          )}

          {!assignee && (
            <button
              type="button"
              onClick={() => setAssignOpen(true)}
              className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent transition-colors hover:bg-accent hover:text-accent-ink"
            >
              {isLeader ? t(locale, "tasks.assign") : t(locale, "tasks.take")}
            </button>
          )}
          {assignee && isLeader && (
            <button
              type="button"
              onClick={() => setAssignOpen(true)}
              className="text-[11px] font-semibold text-ink-3 hover:text-ink"
            >
              {t(locale, "tasks.reassign")}
            </button>
          )}
        </div>
      </div>

      {assignOpen && (
        <TaskAssignDialog
          open={assignOpen}
          onClose={() => setAssignOpen(false)}
          members={members}
          currentAssigneeId={task.assigneeId}
          isLeader={isLeader}
          currentUserId={currentUserId}
          onAssign={(uid) => onAssign(task.id, uid)}
        />
      )}

      {editOpen && (
        <TaskEditDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          task={task}
        />
      )}
    </>
  );
}

function columnLabel(locale: import("@/i18n/messages").Locale, s: ProjectTaskStatus): string {
  if (s === "todo") return t(locale, "tasks.col.todo");
  if (s === "doing") return t(locale, "tasks.col.doing");
  return t(locale, "tasks.col.done");
}
