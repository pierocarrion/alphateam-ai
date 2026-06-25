"use client";

import { useState } from "react";
import { Modal } from "@/features/project-settings/presentation/components/primitives";
import {
  PRIORITY_LABELS,
  type ProjectTask,
  type ProjectTaskPriority,
} from "../types";

interface TaskEditDialogProps {
  open: boolean;
  onClose: () => void;
  task: ProjectTask;
}

const PRIORITIES: (ProjectTaskPriority | "none")[] = [
  "none",
  "low",
  "medium",
  "high",
  "urgent",
];

export function TaskEditDialog({ open, onClose, task }: TaskEditDialogProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<ProjectTaskPriority | "none">(
    task.priority ?? "none"
  );
  const [dueDate, setDueDate] = useState(
    task.dueDate ? task.dueDate.slice(0, 10) : ""
  );

  // Local mutation via dynamic import to avoid circular concerns.
  const handleSave = async () => {
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      priority: priority === "none" ? null : priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    };
    const res = await fetch(
      `/api/workspaces/${task.workspaceId}/tasks/${task.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "No se pudo guardar.");
    }
    onClose();
  };

  const [saving, setSaving] = useState(false);

  const onSave = () => {
    setSaving(true);
    handleSave()
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  return (
    <Modal open={open} onClose={onClose} title="Editar tarea">
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-ink-3">
            Título
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-ink-3">
            Descripción
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-ink-3">
              Prioridad
            </span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as ProjectTaskPriority | "none")}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p === "none" ? "Sin prioridad" : PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-ink-3">
              Vencimiento
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-button px-4 py-2 text-[13.5px] font-semibold text-ink-2 hover:bg-surface-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !title.trim()}
          className="rounded-button bg-accent px-4 py-2 text-[13.5px] font-bold text-accent-ink hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Modal>
  );
}
