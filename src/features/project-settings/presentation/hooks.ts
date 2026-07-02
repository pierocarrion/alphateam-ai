import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectSettingsApi } from "./services";
import type { ProposedAction, BeforeSnapshot } from "../domain/proposedActions";

const settingsKey = (workspaceId: string) => ["project-settings", workspaceId] as const;

export function useProjectSettings(workspaceId: string) {
  return useQuery({
    queryKey: settingsKey(workspaceId),
    queryFn: () => projectSettingsApi.getSettings(workspaceId),
  });
}

export function useInvalidateSettings(workspaceId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: settingsKey(workspaceId) });
}

export function useSaveSmartGoal(workspaceId: string) {
  const invalidate = useInvalidateSettings(workspaceId);
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      projectSettingsApi.saveSmartGoal(workspaceId, body),
    onSuccess: invalidate,
  });
}

export function useAnalyzeSmartGoal(workspaceId: string) {
  return useMutation({
    mutationFn: () => projectSettingsApi.analyzeSmartGoal(workspaceId),
  });
}

export function useSetMethodology(workspaceId: string) {
  const invalidate = useInvalidateSettings(workspaceId);
  return useMutation({
    mutationFn: (body: { primary: string | null; secondary: string[] }) =>
      projectSettingsApi.setMethodology(workspaceId, body),
    onSuccess: invalidate,
  });
}

export function useInviteMember(workspaceId: string) {
  const invalidate = useInvalidateSettings(workspaceId);
  return useMutation({
    mutationFn: (body: { email: string; projectRole: string | null }) =>
      projectSettingsApi.invite(workspaceId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateMember(workspaceId: string) {
  const invalidate = useInvalidateSettings(workspaceId);
  return useMutation({
    mutationFn: ({ memberId, body }: { memberId: string; body: Record<string, unknown> }) =>
      projectSettingsApi.updateMember(workspaceId, memberId, body),
    onSuccess: invalidate,
  });
}

export function useRemoveMember(workspaceId: string) {
  const invalidate = useInvalidateSettings(workspaceId);
  return useMutation({
    mutationFn: (memberId: string) => projectSettingsApi.removeMember(workspaceId, memberId),
    onSuccess: invalidate,
  });
}

export function useSetKpis(workspaceId: string) {
  const invalidate = useInvalidateSettings(workspaceId);
  return useMutation({
    mutationFn: (entries: Array<Record<string, unknown>>) =>
      projectSettingsApi.setKpis(workspaceId, entries),
    onSuccess: invalidate,
  });
}

export function useRegenerateInsights(workspaceId: string) {
  const invalidate = useInvalidateSettings(workspaceId);
  return useMutation({
    mutationFn: () => projectSettingsApi.regenerateInsights(workspaceId),
    onSuccess: invalidate,
  });
}

export function useApplyInsights(workspaceId: string) {
  const invalidate = useInvalidateSettings(workspaceId);
  return useMutation({
    mutationFn: (actions: ProposedAction[]) =>
      projectSettingsApi.applyInsights(workspaceId, actions),
    onSuccess: invalidate,
  });
}

export function useRevertInsights(workspaceId: string) {
  const invalidate = useInvalidateSettings(workspaceId);
  return useMutation({
    mutationFn: (before: BeforeSnapshot) =>
      projectSettingsApi.revertInsights(workspaceId, before),
    onSuccess: invalidate,
  });
}
