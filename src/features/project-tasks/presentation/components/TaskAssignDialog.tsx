"use client";

import { useState } from "react";
import { Modal } from "@/features/project-settings/presentation/components/primitives";
import { Avatar } from "@/shared/ui";
import { personIdFromName } from "@/shared/lib/person";
import type { PersonId } from "@/shared/ui";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";
import type { ProjectMemberOption } from "../types";

interface TaskAssignDialogProps {
  open: boolean;
  onClose: () => void;
  members: ProjectMemberOption[];
  currentAssigneeId: string | null;
  isLeader: boolean;
  currentUserId: string;
  onAssign: (assigneeId: string | null) => void;
}

export function TaskAssignDialog({
  open,
  onClose,
  members,
  currentAssigneeId,
  isLeader,
  currentUserId,
  onAssign,
}: TaskAssignDialogProps) {
  const [selected, setSelected] = useState<string | null>(currentAssigneeId);
  const [locale] = useLocale();

  // Members can only pick themselves.
  const options = isLeader ? members : members.filter((m) => m.id === currentUserId);

  const submit = () => {
    onAssign(selected);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={isLeader ? t(locale, "tasks.assignDialog.titleLeader") : t(locale, "tasks.assignDialog.titleMember")}>
      <div className="space-y-1.5">
        <p className="mb-2 text-[12.5px] text-ink-3">
          {isLeader
            ? t(locale, "tasks.assignDialog.hintLeader")
            : t(locale, "tasks.assignDialog.hintMember")}
        </p>

        {isLeader && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className={`flex w-full items-center gap-2.5 rounded-xl border-[1.5px] px-3 py-2.5 text-left transition-colors ${
              selected === null
                ? "border-accent bg-accent-soft"
                : "border-line hover:bg-surface-2"
            }`}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-line-2 text-[10px] text-ink-3">
              —
            </span>
            <span className="text-[13.5px] font-semibold text-ink-2">{t(locale, "tasks.unassigned")}</span>
          </button>
        )}

        {options.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelected(m.id)}
            className={`flex w-full items-center gap-2.5 rounded-xl border-[1.5px] px-3 py-2.5 text-left transition-colors ${
              selected === m.id
                ? "border-accent bg-accent-soft"
                : "border-line hover:bg-surface-2"
            }`}
          >
            <Avatar
              who={personIdFromName(m.name) as PersonId}
              size={26}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold text-ink">
                {m.name}
                {m.isYou && (
                  <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-ink-3">
                    {t(locale, "tasks.you")}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-button px-4 py-2 text-[13.5px] font-semibold text-ink-2 hover:bg-surface-2"
        >
          {t(locale, "common.cancel")}
        </button>
        <button
          type="button"
          onClick={submit}
          className="rounded-button bg-accent px-4 py-2 text-[13.5px] font-bold text-accent-ink hover:opacity-90"
        >
          {isLeader ? t(locale, "tasks.assign") : t(locale, "tasks.take")}
        </button>
      </div>
    </Modal>
  );
}
