"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/shared/ui";
import {
  useAssignProjectTask,
  useCreateProjectTask,
  useDeleteProjectTask,
  useMoveProjectTask,
  useProjectTasks,
} from "../hooks";
import {
  STATUS_COLUMNS,
  type ProjectMemberOption,
  type ProjectTask,
  type ProjectTaskStatus,
} from "../types";
import { TaskCard } from "./TaskCard";
import { TaskCreateDialog } from "./TaskCreateDialog";
import { Spinner } from "@/features/project-settings/presentation/components/primitives";

interface TasksBoardProps {
  workspaceId: string;
  members: ProjectMemberOption[];
  currentUserId: string;
  isLeader: boolean;
}

export function TasksBoard({
  workspaceId,
  members,
  currentUserId,
  isLeader,
}: TasksBoardProps) {
  const { data, isLoading } = useProjectTasks(workspaceId);
  const createMut = useCreateProjectTask(workspaceId);
  const moveMut = useMoveProjectTask(workspaceId);
  const assignMut = useAssignProjectTask(workspaceId);
  const deleteMut = useDeleteProjectTask(workspaceId);

  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<ProjectTaskStatus>("todo");
  const [filter, setFilter] = useState<"all" | "me" | "unassigned">("all");

  const filtered = useMemo(() => {
    const all = data?.tasks ?? [];
    if (filter === "me") return all.filter((t) => t.assigneeId === currentUserId);
    if (filter === "unassigned") return all.filter((t) => !t.assigneeId);
    return all;
  }, [data?.tasks, filter, currentUserId]);

  const byColumn = useMemo(() => {
    const map: Record<ProjectTaskStatus, ProjectTask[]> = { todo: [], doing: [], done: [] };
    for (const t of filtered) map[t.status]?.push(t);
    return map;
  }, [filtered]);

  const openCreate = (status: ProjectTaskStatus) => {
    setCreateStatus(status);
    setCreateOpen(true);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4 lg:px-8">
        <div className="flex items-center gap-2">
          {(["all", "me", "unassigned"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                filter === f
                  ? "bg-accent-soft text-accent"
                  : "text-ink-3 hover:bg-surface-2"
              }`}
            >
              {f === "all" ? "Todas" : f === "me" ? "Mías" : "Sin asignar"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => openCreate("todo")}
          className="flex items-center gap-1.5 rounded-button bg-accent px-3.5 py-2 text-[13px] font-bold text-accent-ink hover:opacity-90"
        >
          <Icon name="plus" size={15} color="currentColor" stroke={2.5} />
          Nueva tarea
        </button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-auto px-6 py-5 lg:px-8">
        {isLoading ? (
          <Spinner label="Cargando tareas…" />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STATUS_COLUMNS.map((col) => {
              const colTasks = byColumn[col.key];
              return (
                <div
                  key={col.key}
                  className="flex min-h-[200px] flex-col rounded-2xl border border-line bg-bg-2/40 p-3"
                >
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-ink">
                          {col.label}
                        </span>
                        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-bold text-ink-3">
                          {colTasks.length}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-3">{col.hint}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreate(col.key)}
                      className="rounded-lg p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                      aria-label={`Añadir a ${col.label}`}
                    >
                      <Icon name="plus" size={16} color="currentColor" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {colTasks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-line-2 px-3 py-6 text-center">
                        <p className="text-[12px] text-ink-3">Sin tareas aquí.</p>
                      </div>
                    ) : (
                      colTasks.map((t) => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          status={col.key}
                          members={members}
                          currentUserId={currentUserId}
                          isLeader={isLeader}
                          onMove={(id, status) => moveMut.mutate({ taskId: id, status })}
                          onAssign={(id, uid) =>
                            assignMut.mutate({ taskId: id, assigneeId: uid })
                          }
                          onDelete={(id) => deleteMut.mutate(id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TaskCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        members={members}
        currentUserId={currentUserId}
        isLeader={isLeader}
        defaultStatus={createStatus}
        onCreate={(body) => createMut.mutate(body)}
      />
    </div>
  );
}
