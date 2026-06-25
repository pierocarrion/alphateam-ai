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

export const STATUS_COLUMNS: { key: ProjectTaskStatus; labelKey: string; hintKey: string }[] = [
  { key: "todo", labelKey: "tasks.col.todo", hintKey: "tasks.col.todoHint" },
  { key: "doing", labelKey: "tasks.col.doing", hintKey: "tasks.col.doingHint" },
  { key: "done", labelKey: "tasks.col.done", hintKey: "tasks.col.doneHint" },
];

export const PRIORITY_KEYS: Record<ProjectTaskPriority, string> = {
  low: "tasks.priority.low",
  medium: "tasks.priority.medium",
  high: "tasks.priority.high",
  urgent: "tasks.priority.urgent",
};

export const PRIORITY_COLORS: Record<ProjectTaskPriority, string> = {
  low: "var(--color-ink-3)",
  medium: "var(--color-accent)",
  high: "var(--color-glow)",
  urgent: "var(--color-glow)",
};
