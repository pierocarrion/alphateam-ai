import type { IPhaseTrackingRepository } from "../../domain/repositories";
import type { IAuditRepository } from "@/features/project-settings/domain/repositories";
import { UserFacingError } from "@/server/lib/errors";
import {
  toggleArtifactSchema,
  type ToggleArtifactInput,
} from "../../application/schemas";
import { getMethodologyPhases } from "../../domain/visualization";

export interface ToggleArtifactDeps {
  phaseTrackingRepository: IPhaseTrackingRepository;
  auditRepository: IAuditRepository;
}

export interface ToggleArtifactRequest {
  workspaceId: string;
  methodologyKey: string;
  artifactKey: string;
  actorId: string;
  input: ToggleArtifactInput;
}

/**
 * Cambia los flags `mandatory` / `visible` de un artefacto.
 * Esto resuelve el requisito "no obligatorio": el líder decide qué artefactos
 * son requeridos y cuáles ocultar del ruido visual.
 */
export class ToggleArtifact {
  constructor(private readonly deps: ToggleArtifactDeps) {}

  async execute(request: ToggleArtifactRequest) {
    const input = toggleArtifactSchema.parse(request.input);

    const phase = getMethodologyPhases(request.methodologyKey).find((p) =>
      p.items.some((i) => i.key === request.artifactKey)
    );
    if (!phase) {
      throw new UserFacingError("El artefacto no pertenece a la metodología.", 400);
    }

    const result = await this.deps.phaseTrackingRepository.upsertArtifact(
      request.workspaceId,
      {
        methodologyKey: request.methodologyKey,
        phaseKey: phase.phaseKey,
        artifactKey: request.artifactKey,
        mandatory: input.mandatory,
        visible: input.visible,
      }
    );

    await this.deps.auditRepository.record({
      workspaceId: request.workspaceId,
      actorId: request.actorId,
      action: "artifact.toggle",
      entity: "artifact",
      entityId: request.artifactKey,
      after: { mandatory: result.mandatory, visible: result.visible },
    });

    return result;
  }
}
