import type {
  ArtifactStatus,
  PhaseStatus,
  ProjectArtifactState,
  ProjectPhaseState,
} from "./entities";

/**
 * Vista combinada de una fase (sección de metodología) enriquecida con su
 * estado persistente y el de sus artefactos. Es lo que consume la UI.
 */
export interface PhaseView {
  phaseKey: string;
  title: string;
  order: number;
  kind: string;
  status: PhaseStatus;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  artifacts: ArtifactView[];
  /** 0..100 — % de artefactos visibles marcados como `done`. */
  progress: number;
}

export interface ArtifactView {
  artifactKey: string;
  name: string;
  description: string | null;
  prompts: string[];
  status: ArtifactStatus;
  mandatory: boolean;
  visible: boolean;
  filledContent: string | null;
  knowledgeResourceId: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * Progreso agregado del proyecto dentro de su metodología primaria.
 */
export interface MethodologyProgressSummary {
  methodologyKey: string;
  methodologyName: string;
  methodologyEmoji: string;
  /** Visualización recomendada para la metodología (linear | cyclic). */
  visualization: "linear" | "cyclic";
  totalArtifacts: number;
  doneArtifacts: number;
  /** 0..100 */
  progress: number;
  phases: PhaseView[];
}

export interface IPhaseTrackingRepository {
  listPhases(workspaceId: string, methodologyKey: string): Promise<ProjectPhaseState[]>;
  listArtifacts(workspaceId: string): Promise<ProjectArtifactState[]>;
  upsertPhase(
    workspaceId: string,
    methodologyKey: string,
    phaseKey: string,
    patch: {
      status?: PhaseStatus;
      notes?: string | null;
      startedAt?: Date | null;
      completedAt?: Date | null;
    }
  ): Promise<ProjectPhaseState>;
  upsertArtifact(
    workspaceId: string,
    input: {
      methodologyKey: string;
      phaseKey: string;
      artifactKey: string;
      status?: ArtifactStatus;
      mandatory?: boolean;
      visible?: boolean;
      filledContent?: string | null;
      knowledgeResourceId?: string | null;
      startedAt?: Date | null;
      completedAt?: Date | null;
    }
  ): Promise<ProjectArtifactState>;
  seedForMethodology(
    workspaceId: string,
    methodologyKey: string,
    phases: Array<{ phaseKey: string }>
  ): Promise<void>;
}
