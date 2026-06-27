import { PrismaPhaseTrackingRepository } from "./PrismaPhaseTrackingRepository";
import type { IPhaseTrackingRepository } from "../domain/repositories";
import { getProjectSettingsDeps } from "@/features/project-settings/infrastructure/container";
import { container as knowledgeContainer } from "@/server/lib/container";
import type { IKnowledgeRepository } from "@/features/knowledge/domain/repositories/IKnowledgeRepository";

export interface ProjectPhasesDeps {
  phaseTrackingRepository: IPhaseTrackingRepository;
  knowledgeRepository: IKnowledgeRepository;
  auditRepository: ReturnType<typeof getProjectSettingsDeps>["auditRepository"];
}

export function createProjectPhasesDeps(): ProjectPhasesDeps {
  return {
    phaseTrackingRepository: new PrismaPhaseTrackingRepository(),
    knowledgeRepository: knowledgeContainer.knowledgeRepository,
    auditRepository: getProjectSettingsDeps().auditRepository,
  };
}

let cached: ProjectPhasesDeps | null = null;
export function getProjectPhasesDeps(): ProjectPhasesDeps {
  if (!cached) cached = createProjectPhasesDeps();
  return cached;
}

export function __resetProjectPhasesDeps(): void {
  cached = null;
}
