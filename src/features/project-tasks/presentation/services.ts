import { fetchJson } from "@/shared/lib/api";
import type { ProjectTask, ProjectTaskStatus, ProjectTaskPriority } from "./types";

const base = (workspaceId: string) => `/api/workspaces/${workspaceId}/tasks`;

export const projectTasksApi = {
  list(workspaceId: string) {
    return fetchJson<{ tasks: ProjectTask[] }>(base(workspaceId));
  },

  create(
    workspaceId: string,
    body: {
      title: string;
      description?: string;
      status?: ProjectTaskStatus;
      priority?: ProjectTaskPriority | null;
      dueDate?: string | null;
      tags?: string[];
      assigneeId?: string | null;
    }
  ) {
    return fetchJson<{ task: ProjectTask }>(base(workspaceId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  update(
    workspaceId: string,
    taskId: string,
    body: Partial<{
      title: string;
      description: string | null;
      status: ProjectTaskStatus;
      priority: ProjectTaskPriority | null;
      dueDate: string | null;
      tags: string[];
      order: number;
    }>
  ) {
    return fetchJson<{ task: ProjectTask }>(`${base(workspaceId)}/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  remove(workspaceId: string, taskId: string) {
    return fetchJson<{ ok: true }>(`${base(workspaceId)}/${taskId}`, {
      method: "DELETE",
    });
  },

  assign(workspaceId: string, taskId: string, assigneeId: string | null) {
    return fetchJson<{ task: ProjectTask }>(`${base(workspaceId)}/${taskId}/assignee`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeId }),
    });
  },
};
