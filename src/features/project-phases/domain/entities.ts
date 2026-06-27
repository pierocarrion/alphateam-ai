/**
 * Estado de avance de una fase/estación de la metodología en un proyecto.
 * No es obligatorio: el usuario puede dejar todas las fases en `not_started`.
 */
export type PhaseStatus = "not_started" | "in_progress" | "done" | "skipped";

/**
 * Estado de avance de un artefacto/herramienta de la metodología.
 * Cada artefacto puede materializarse como un KnowledgeResource para
 * integrarse con la base de conocimiento del proyecto.
 */
export type ArtifactStatus = "pending" | "in_progress" | "done" | "skipped";

export interface ProjectPhaseState {
  id: string;
  workspaceId: string;
  methodologyKey: string;
  phaseKey: string;
  status: PhaseStatus;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectArtifactState {
  id: string;
  workspaceId: string;
  phaseId: string;
  methodologyKey: string;
  phaseKey: string;
  artifactKey: string;
  status: ArtifactStatus;
  mandatory: boolean;
  visible: boolean;
  filledContent: string | null;
  knowledgeResourceId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const PHASE_STATUS_VALUES: PhaseStatus[] = [
  "not_started",
  "in_progress",
  "done",
  "skipped",
];

export const ARTIFACT_STATUS_VALUES: ArtifactStatus[] = [
  "pending",
  "in_progress",
  "done",
  "skipped",
];

export function isPhaseStatus(v: string): v is PhaseStatus {
  return (PHASE_STATUS_VALUES as string[]).includes(v);
}

export function isArtifactStatus(v: string): v is ArtifactStatus {
  return (ARTIFACT_STATUS_VALUES as string[]).includes(v);
}
