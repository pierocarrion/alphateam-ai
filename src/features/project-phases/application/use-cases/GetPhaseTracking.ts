import {
  getMethodologyContent,
  methodologyFacade,
} from "@/features/project-settings/domain/methodology-content";
import type { IKnowledgeRepository } from "@/features/knowledge/domain/repositories/IKnowledgeRepository";
import type { IPhaseTrackingRepository } from "../../domain/repositories";
import {
  getMethodologyPhases,
  getMethodologyVisualization,
} from "../../domain/visualization";
import type {
  MethodologyProgressSummary,
  PhaseView,
  ArtifactView,
} from "../../domain/repositories";
import { ARTIFACT_STATUS_VALUES, PHASE_STATUS_VALUES } from "../../domain/entities";
import type { ArtifactStatus, PhaseStatus } from "../../domain/entities";

export interface GetPhaseTrackingDeps {
  phaseTrackingRepository: IPhaseTrackingRepository;
  knowledgeRepository: IKnowledgeRepository;
}

export interface GetPhaseTrackingRequest {
  workspaceId: string;
  methodologyKey: string;
}

export class GetPhaseTracking {
  constructor(private readonly deps: GetPhaseTrackingDeps) {}

  async execute(request: GetPhaseTrackingRequest): Promise<MethodologyProgressSummary | null> {
    const content = getMethodologyContent(request.methodologyKey);
    if (!content) return null;

    const facade = methodologyFacade(request.methodologyKey);
    const catalogPhases = getMethodologyPhases(request.methodologyKey);

    const [dbPhases, dbArtifacts] = await Promise.all([
      this.deps.phaseTrackingRepository.listPhases(request.workspaceId, request.methodologyKey),
      this.deps.phaseTrackingRepository.listArtifacts(request.workspaceId),
    ]);

    const phaseByKey = new Map(dbPhases.map((p) => [p.phaseKey, p]));
    const artifactByKey = new Map(dbArtifacts.map((a) => [a.artifactKey, a]));

    const phases: PhaseView[] = catalogPhases.map((catalogPhase) => {
      const dbPhase = phaseByKey.get(catalogPhase.phaseKey);
      const status: PhaseStatus = dbPhase
        ? normalizePhaseStatus(dbPhase.status)
        : "not_started";

      const artifacts: ArtifactView[] = catalogPhase.items.map((item) => {
        const dbArt = artifactByKey.get(item.key);
        return {
          artifactKey: item.key,
          name: item.name,
          description: item.description ?? null,
          prompts: item.prompts ?? [],
          status: dbArt ? normalizeArtifactStatus(dbArt.status) : "pending",
          mandatory: dbArt?.mandatory ?? false,
          visible: dbArt?.visible ?? true,
          filledContent: dbArt?.filledContent ?? null,
          knowledgeResourceId: dbArt?.knowledgeResourceId ?? null,
          startedAt: dbArt?.startedAt ?? null,
          completedAt: dbArt?.completedAt ?? null,
        };
      });

      const visibleArtifacts = artifacts.filter((a) => a.visible);
      const doneCount = visibleArtifacts.filter((a) => a.status === "done").length;
      const progress =
        visibleArtifacts.length === 0
          ? 0
          : Math.round((doneCount / visibleArtifacts.length) * 100);

      return {
        phaseKey: catalogPhase.phaseKey,
        title: catalogPhase.title,
        order: catalogPhase.order,
        kind: catalogPhase.kind,
        status,
        notes: dbPhase?.notes ?? null,
        startedAt: dbPhase?.startedAt ?? null,
        completedAt: dbPhase?.completedAt ?? null,
        artifacts,
        progress,
      };
    });

    const totalArtifacts = phases.reduce(
      (acc, p) => acc + p.artifacts.filter((a) => a.visible).length,
      0
    );
    const doneArtifacts = phases.reduce(
      (acc, p) => acc + p.artifacts.filter((a) => a.visible && a.status === "done").length,
      0
    );

    return {
      methodologyKey: request.methodologyKey,
      methodologyName: facade.name,
      methodologyEmoji: facade.emoji,
      visualization: getMethodologyVisualization(request.methodologyKey),
      totalArtifacts,
      doneArtifacts,
      progress: totalArtifacts === 0 ? 0 : Math.round((doneArtifacts / totalArtifacts) * 100),
      phases,
    };
  }
}

function normalizePhaseStatus(v: string): PhaseStatus {
  return (PHASE_STATUS_VALUES as string[]).includes(v) ? (v as PhaseStatus) : "not_started";
}

function normalizeArtifactStatus(v: string): ArtifactStatus {
  return (ARTIFACT_STATUS_VALUES as string[]).includes(v) ? (v as ArtifactStatus) : "pending";
}
