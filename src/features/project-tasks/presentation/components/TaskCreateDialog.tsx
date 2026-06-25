"use client";

import { useState } from "react";
import { Modal } from "@/features/project-settings/presentation/components/primitives";
import { Avatar } from "@/shared/ui";
import { personIdFromName } from "@/shared/lib/person";
import type { PersonId } from "@/shared/ui";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";
import {
  PRIORITY_KEYS,
  type ProjectMemberOption,
  type ProjectTaskPriority,
  type ProjectTaskStatus,
} from "../types";

interface TaskCreateDialogProps {
  open: boolean;
  onClose: () => void;
  members: ProjectMemberOption[];
  currentUserId: string;
  isLeader: boolean;
  defaultStatus?: ProjectTaskStatus;
  onCreate: (body: {
    title: string;
    description?: string;
    status?: ProjectTaskStatus;
    priority?: ProjectTaskPriority | null;
    dueDate?: string | null;
    assigneeId?: string | null;
  }) => void;
}

const PRIORITIES: (ProjectTaskPriority | "none")[] = [
  "none",
  "low",
  "medium",
  "high",
  "urgent",
];

export function TaskCreateDialog({
  open,
  onClose,
  members,
  currentUserId,
  isLeader,
  defaultStatus = "todo",
  onCreate,
}: TaskCreateDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ProjectTaskPriority | "none">("none");
  const [dueDate, setDueDate] = useState("");
  const [locale] = useLocale();
  // Members default to self-assignment; leaders default to unassigned.
  const [assigneeId, setAssigneeId] = useState<string | null>(
    isLeader ? null : currentUserId
  );

  const reset = () => {
    setTitle("");
    setDescription("");
    setPriority("none");
    setDueDate("");
    setAssigneeId(isLeader ? null : currentUserId);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      status: defaultStatus,
      priority: priority === "none" ? null : priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      assigneeId,
    });
    reset();
    onClose();
  };

  const assigneeOptions = isLeader
    ? members
    : members.filter((m) => m.id === currentUserId);

  const selectedAssignee = assigneeId
    ? members.find((m) => m.id === assigneeId) ?? null
    : null;

  return (
    <Modal open={open} onClose={close} title={t(locale, "tasks.create.title")}>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-ink-3">
            {t(locale, "tasks.create.titleLabel")}
          </span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t(locale, "tasks.create.titlePlaceholder")}
            className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-ink-3">
            {t(locale, "tasks.create.description")}
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={t(locale, "tasks.create.descriptionPlaceholder")}
            className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-ink-3">
              {t(locale, "tasks.create.priority")}
            </span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as ProjectTaskPriority | "none")}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p === "none" ? t(locale, "tasks.priority.none") : t(locale, PRIORITY_KEYS[p])}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-ink-3">
              {t(locale, "tasks.create.due")}
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-ink-3">
            {t(locale, "tasks.create.assignTo")}
          </span>
          <select
            value={assigneeId ?? ""}
            onChange={(e) => setAssigneeId(e.target.value || null)}
            className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
          >
            {isLeader && <option value="">{t(locale, "tasks.unassigned")}</option>}
            {assigneeOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.isYou ? t(locale, "tasks.create.youSuffix") : ""}
              </option>
            ))}
          </select>
          {selectedAssignee && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-ink-3">
              <Avatar
                who={personIdFromName(selectedAssignee.name) as PersonId}
                size={16}
              />
              <span>{selectedAssignee.name}</span>
            </div>
          )}
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={close}
          className="rounded-button px-4 py-2 text-[13.5px] font-semibold text-ink-2 hover:bg-surface-2"
        >
          {t(locale, "common.cancel")}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim()}
          className="rounded-button bg-accent px-4 py-2 text-[13.5px] font-bold text-accent-ink hover:opacity-90 disabled:opacity-50"
        >
          {t(locale, "tasks.create.submit")}
        </button>
      </div>
    </Modal>
  );
}
