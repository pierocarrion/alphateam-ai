import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { projectTasksApi } from "./services";
import type { ProjectTaskPriority, ProjectTaskStatus } from "./types";

const tasksKey = (workspaceId: string) => ["project-tasks", workspaceId] as const;

function useInvalidateTasks(workspaceId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: tasksKey(workspaceId) });
}

export function useProjectTasks(workspaceId: string) {
  return useQuery({
    queryKey: tasksKey(workspaceId),
    queryFn: () => projectTasksApi.list(workspaceId),
  });
}

export function useCreateProjectTask(workspaceId: string) {
  const invalidate = useInvalidateTasks(workspaceId);
  return useMutation({
    mutationFn: projectTasksApi.create.bind(null, workspaceId),
    onSuccess: () => {
      invalidate();
      toast.success("Tarea creada.");
    },
  });
}

export function useUpdateProjectTask(workspaceId: string) {
  const invalidate = useInvalidateTasks(workspaceId);
  return useMutation({
    mutationFn: ({ taskId, body }: { taskId: string; body: Record<string, unknown> }) =>
      projectTasksApi.update(workspaceId, taskId, body),
    onSuccess: invalidate,
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la tarea.");
    },
  });
}

export function useMoveProjectTask(workspaceId: string) {
  const invalidate = useInvalidateTasks(workspaceId);
  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: ProjectTaskStatus }) =>
      projectTasksApi.update(workspaceId, taskId, { status }),
    onSuccess: invalidate,
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "No se pudo mover la tarea.");
    },
  });
}

export function useAssignProjectTask(workspaceId: string) {
  const invalidate = useInvalidateTasks(workspaceId);
  return useMutation({
    mutationFn: ({ taskId, assigneeId }: { taskId: string; assigneeId: string | null }) =>
      projectTasksApi.assign(workspaceId, taskId, assigneeId),
    onSuccess: invalidate,
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "No se pudo asignar la tarea.");
    },
  });
}

export function useDeleteProjectTask(workspaceId: string) {
  const invalidate = useInvalidateTasks(workspaceId);
  return useMutation({
    mutationFn: (taskId: string) => projectTasksApi.remove(workspaceId, taskId),
    onSuccess: () => {
      invalidate();
      toast.success("Tarea eliminada.");
    },
  });
}

export function useTogglePriority(workspaceId: string) {
  const invalidate = useInvalidateTasks(workspaceId);
  return useMutation({
    mutationFn: ({ taskId, priority }: { taskId: string; priority: ProjectTaskPriority | null }) =>
      projectTasksApi.update(workspaceId, taskId, { priority }),
    onSuccess: invalidate,
  });
}
