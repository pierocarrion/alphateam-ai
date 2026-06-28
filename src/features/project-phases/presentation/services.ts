import { fetchJson } from "@/shared/lib/api";
import type { MethodologyProgressSummary } from "../domain/repositories";

const base = (workspaceId: string) => `/api/workspaces/${workspaceId}`;

export const projectPhasesApi = {
  getSummary(workspaceId: string, methodologyKey?: string) {
    const qs = methodologyKey ? `?methodologyKey=${encodeURIComponent(methodologyKey)}` : "";
    return fetchJson<{ summary: MethodologyProgressSummary | null }>(
      `${base(workspaceId)}/phases${qs}`
    );
  },

  advancePhase(
    workspaceId: string,
    phaseKey: string,
    body: { status?: string; notes?: string | null }
  ) {
    return fetchJson<{ phase: unknown }>(
      `${base(workspaceId)}/phases/${encodeURIComponent(phaseKey)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
  },

  setArtifactStatus(workspaceId: string, artifactKey: string, status: string) {
    return fetchJson<{ artifact: unknown }>(
      `${base(workspaceId)}/artifacts/${encodeURIComponent(artifactKey)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }
    );
  },

  toggleArtifact(
    workspaceId: string,
    artifactKey: string,
    body: { mandatory?: boolean; visible?: boolean }
  ) {
    return fetchJson<{ artifact: unknown }>(
      `${base(workspaceId)}/artifacts/${encodeURIComponent(artifactKey)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
  },

  saveArtifactContent(workspaceId: string, artifactKey: string, answers: Record<string, string>) {
    return fetchJson<{ artifact: unknown; knowledgeResourceId: string }>(
      `${base(workspaceId)}/artifacts/${encodeURIComponent(artifactKey)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      }
    );
  },

  updatePhaseConfig(
    workspaceId: string,
    body: { currentPhaseKey?: string | null; requirePhaseStarted?: boolean }
  ) {
    return fetchJson<{ config: unknown }>(
      `${base(workspaceId)}/phases/config`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
  },
};
