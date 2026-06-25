export type ProjectTaskStatus = "todo" | "doing" | "done";
export type ProjectTaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskUser {
  id: string;
  name: string | null;
}

export interface ProjectTask {
  id: string;
  workspaceId: string;
  assigneeId: string | null;
  createdById: string;
  title: string;
  description: string | null;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority | null;
  dueDate: string | null;
  tags: string[];
  order: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  assignee: TaskUser | null;
  createdBy: TaskUser;
}

export interface ProjectMemberOption {
  id: string;
  name: string;
  role: string;
  isYou: boolean;
}

export const STATUS_COLUMNS: { key: ProjectTaskStatus; label: string; hint: string }[] = [
  { key: "todo", label: "Por hacer", hint: "Sin empezar" },
  { key: "doing", label: "En progreso", hint: "Trabajando ahora" },
  { key: "done", label: "Hecho", hint: "Completado" },
];

export const PRIORITY_LABELS: Record<ProjectTaskPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const PRIORITY_COLORS: Record<ProjectTaskPriority, string> = {
  low: "var(--color-ink-3)",
  medium: "var(--color-accent)",
  high: "var(--color-glow)",
  urgent: "var(--color-glow)",
};
