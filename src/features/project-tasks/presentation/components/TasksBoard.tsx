"use client";

import { useMemo, useState, type DragEvent } from "react";
import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui";
import { useLocale } from "@/i18n/useLocale";
import { t } from "@/i18n/messages";
import {
  useAssignProjectTask,
  useCreateProjectTask,
  useDeleteProjectTask,
  useMoveProjectTask,
  useProjectTasks,
  useReorderProjectTasks,
} from "../hooks";
import {
  STATUS_COLUMNS,
  type ProjectMemberOption,
  type ProjectTask,
  type ProjectTaskStatus,
} from "../types";
import { TaskCard } from "./TaskCard";
import type { TaskCardDnd } from "./TaskCard";
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
  const [locale] = useLocale();

  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<ProjectTaskStatus>("todo");
  const [filter, setFilter] = useState<"all" | "me" | "unassigned">("all");
  const [phaseFilter, setPhaseFilter] = useState<string | null>(null);

  const phaseOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const t of data?.tasks ?? []) {
      if (t.phaseKey) keys.add(t.phaseKey);
    }
    return Array.from(keys);
  }, [data?.tasks]);

  const filtered = useMemo(() => {
    let all = data?.tasks ?? [];
    if (phaseFilter) all = all.filter((t) => t.phaseKey === phaseFilter);
    if (filter === "me") return all.filter((t) => t.assigneeId === currentUserId);
    if (filter === "unassigned") return all.filter((t) => !t.assigneeId);
    return all;
  }, [data?.tasks, filter, currentUserId, phaseFilter]);

  const byColumn = useMemo(() => {
    const map: Record<ProjectTaskStatus, ProjectTask[]> = { todo: [], doing: [], done: [] };
    for (const t of filtered) map[t.status]?.push(t);
    return map;
  }, [filtered]);

  const reorderMut = useReorderProjectTasks(workspaceId);

  // DnD is only meaningful in the unfiltered "all" view: filters hide cards,
  // so positional indices would no longer map to real storage order. Moving a
  // task while a filter is active can still be done via the card's menu.
  const dndEnabled = filter === "all" && phaseFilter === null && !reorderMut.isPending;

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    status: ProjectTaskStatus;
    index: number;
  } | null>(null);

  const resetDrag = () => {
    setDragId(null);
    setDropTarget(null);
  };

  const handleDrop = () => {
    if (!dragId || !dropTarget) {
      resetDrag();
      return;
    }
    const dragged = (data?.tasks ?? []).find((tk) => tk.id === dragId);
    if (!dragged) {
      resetDrag();
      return;
    }

    const target = dropTarget.status;
    const sameCol = dragged.status === target;
    const fullCol = byColumn[target];
    // Remove the dragged card, then insert it at the computed index.
    const without = fullCol.filter((tk) => tk.id !== dragId);
    let insertAt = Math.max(0, Math.min(dropTarget.index, without.length));
    if (sameCol) {
      // The drop index was measured against the column that still contained
      // the dragged card, so shift it down when the card sat above the index.
      const origIdx = fullCol.findIndex((tk) => tk.id === dragId);
      if (origIdx !== -1 && dropTarget.index > origIdx) {
        insertAt = Math.max(0, dropTarget.index - 1);
      }
    }

    const newList = [
      ...without.slice(0, insertAt),
      dragged,
      ...without.slice(insertAt),
    ];

    // Assign sequential integer orders; include status only when it changed.
    const updates: {
      id: string;
      status?: ProjectTaskStatus;
      order: number;
    }[] = [];
    newList.forEach((tk, i) => {
      const statusChanged = tk.status !== target;
      if (tk.order !== i || statusChanged) {
        updates.push({
          id: tk.id,
          ...(statusChanged ? { status: target } : {}),
          order: i,
        });
      }
    });

    resetDrag();
    if (updates.length === 0) return;

    const optimisticTasks = (data?.tasks ?? []).map((tk) => {
      const u = updates.find((x) => x.id === tk.id);
      if (!u) return tk;
      let completedAt = tk.completedAt;
      if (u.status === "done" && tk.status !== "done") {
        completedAt = new Date().toISOString();
      } else if (u.status && u.status !== "done" && tk.status === "done") {
        completedAt = null;
      }
      return {
        ...tk,
        order: u.order,
        ...(u.status ? { status: u.status } : {}),
        completedAt,
      };
    });

    reorderMut.mutate({ updates, optimisticTasks });
  };

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
              {f === "all" ? t(locale, "tasks.filter.all") : f === "me" ? t(locale, "tasks.filter.me") : t(locale, "tasks.filter.unassigned")}
            </button>
          ))}
          {phaseOptions.length > 0 && (
            <select
              value={phaseFilter ?? ""}
              onChange={(e) => setPhaseFilter(e.target.value || null)}
              className="ml-2 rounded-full border border-line-2 bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 outline-none"
            >
              <option value="">Todas las fases</option>
              {phaseOptions.map((p) => (
                <option key={p} value={p}>
                  {p.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          )}
        </div>
        <button
          type="button"
          onClick={() => openCreate("todo")}
          className="flex items-center gap-1.5 rounded-button bg-accent px-3.5 py-2 text-[13px] font-bold text-accent-ink hover:opacity-90"
        >
          <Icon name="plus" size={15} color="currentColor" stroke={2.5} />
          {t(locale, "tasks.newTask")}
        </button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-auto px-6 py-5 lg:px-8">
        {isLoading ? (
          <Spinner label={t(locale, "tasks.loading")} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STATUS_COLUMNS.map((col) => {
              const colTasks = byColumn[col.key];
              const colLabel = t(locale, col.labelKey);
              const isDropCol = dropTarget?.status === col.key;
              const showColEnd =
                isDropCol && dropTarget.index >= colTasks.length;
              const handleColDragOver = (e: DragEvent<HTMLDivElement>) => {
                if (!dragId) return;
                e.preventDefault();
                // Only fires for the column's own empty area: cards stop
                // propagation on their dragOver so this never clobbers a
                // precise card-based index.
                setDropTarget({ status: col.key, index: colTasks.length });
              };
              return (
                <div
                  key={col.key}
                  onDragOver={handleColDragOver}
                  onDrop={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    handleDrop();
                  }}
                  className={cn(
                    "flex min-h-[200px] flex-col rounded-2xl border bg-bg-2/40 p-3 transition-colors",
                    isDropCol ? "border-accent/60 bg-accent-soft/30" : "border-line"
                  )}
                >
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-ink">
                          {colLabel}
                        </span>
                        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-bold text-ink-3">
                          {colTasks.length}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-3">{t(locale, col.hintKey)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreate(col.key)}
                      className="rounded-lg p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                      aria-label={t(locale, "tasks.addTo", { label: colLabel })}
                    >
                      <Icon name="plus" size={16} color="currentColor" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {colTasks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-line-2 px-3 py-6 text-center">
                        <p className="text-[12px] text-ink-3">{t(locale, "tasks.empty")}</p>
                      </div>
                    ) : (
                      colTasks.map((tk, index) => {
                        const cardDnd: TaskCardDnd | undefined = dndEnabled
                          ? {
                              enabled:
                                isLeader ||
                                tk.assigneeId === currentUserId ||
                                tk.createdById === currentUserId,
                              isDragging: dragId === tk.id,
                              dropIndicator:
                                isDropCol && dropTarget.index === index
                                  ? "before"
                                  : isDropCol && dropTarget.index === index + 1
                                  ? "after"
                                  : null,
                              onDragStart: () => {
                                setDragId(tk.id);
                                setDropTarget({ status: col.key, index });
                              },
                              onDragOver: (e) => {
                                if (!dragId) return;
                                e.preventDefault();
                                e.stopPropagation();
                                const rect =
                                  e.currentTarget.getBoundingClientRect();
                                const after =
                                  e.clientY > rect.top + rect.height / 2;
                                setDropTarget({
                                  status: col.key,
                                  index: after ? index + 1 : index,
                                });
                              },
                              onDrop: (e) => {
                                if (!dragId) return;
                                e.preventDefault();
                                e.stopPropagation();
                                handleDrop();
                              },
                              onDragEnd: resetDrag,
                            }
                          : undefined;
                        return (
                          <TaskCard
                            key={tk.id}
                            task={tk}
                            status={col.key}
                            members={members}
                            currentUserId={currentUserId}
                            isLeader={isLeader}
                            onMove={(id, status) =>
                              moveMut.mutate({ taskId: id, status })
                            }
                            onAssign={(id, uid) =>
                              assignMut.mutate({ taskId: id, assigneeId: uid })
                            }
                            onDelete={(id) => deleteMut.mutate(id)}
                            dnd={cardDnd}
                          />
                        );
                      })
                    )}
                    {showColEnd && (
                      <span
                        aria-hidden
                        className="h-[3px] shrink-0 rounded-full bg-accent"
                      />
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
