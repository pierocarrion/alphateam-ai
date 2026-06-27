import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectPhasesApi } from "./services";

const phasesKey = (workspaceId: string, methodologyKey?: string) =>
  ["project-phases", workspaceId, methodologyKey ?? "primary"] as const;

export function usePhaseTracking(workspaceId: string, methodologyKey?: string) {
  return useQuery({
    queryKey: phasesKey(workspaceId, methodologyKey),
    queryFn: () => projectPhasesApi.getSummary(workspaceId, methodologyKey),
  });
}

export function useInvalidatePhases(workspaceId: string, methodologyKey?: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: phasesKey(workspaceId, methodologyKey) });
}

export function useAdvancePhase(workspaceId: string, methodologyKey?: string) {
  const invalidate = useInvalidatePhases(workspaceId, methodologyKey);
  return useMutation({
    mutationFn: ({ phaseKey, body }: { phaseKey: string; body: { status?: string; notes?: string | null } }) =>
      projectPhasesApi.advancePhase(workspaceId, phaseKey, body),
    onSuccess: invalidate,
  });
}

export function useSetArtifactStatus(workspaceId: string, methodologyKey?: string) {
  const invalidate = useInvalidatePhases(workspaceId, methodologyKey);
  return useMutation({
    mutationFn: ({ artifactKey, status }: { artifactKey: string; status: string }) =>
      projectPhasesApi.setArtifactStatus(workspaceId, artifactKey, status),
    onSuccess: invalidate,
  });
}

export function useToggleArtifact(workspaceId: string, methodologyKey?: string) {
  const invalidate = useInvalidatePhases(workspaceId, methodologyKey);
  return useMutation({
    mutationFn: ({
      artifactKey,
      body,
    }: {
      artifactKey: string;
      body: { mandatory?: boolean; visible?: boolean };
    }) => projectPhasesApi.toggleArtifact(workspaceId, artifactKey, body),
    onSuccess: invalidate,
  });
}

export function useSaveArtifactContent(workspaceId: string, methodologyKey?: string) {
  const invalidate = useInvalidatePhases(workspaceId, methodologyKey);
  return useMutation({
    mutationFn: ({ artifactKey, answers }: { artifactKey: string; answers: Record<string, string> }) =>
      projectPhasesApi.saveArtifactContent(workspaceId, artifactKey, answers),
    onSuccess: invalidate,
  });
}
