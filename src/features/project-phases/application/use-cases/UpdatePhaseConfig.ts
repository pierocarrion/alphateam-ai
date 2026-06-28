import type { IPhaseTrackingRepository } from "../../domain/repositories";
import type { IAuditRepository } from "@/features/project-settings/domain/repositories";
import { UserFacingError } from "@/server/lib/errors";
import {
  updatePhaseConfigSchema,
  type UpdatePhaseConfigInput,
} from "../../application/schemas";
import { getMethodologyPhases } from "../../domain/visualization";

export interface UpdatePhaseConfigDeps {
  phaseTrackingRepository: IPhaseTrackingRepository;
  auditRepository: IAuditRepository;
}

export interface UpdatePhaseConfigRequest {
  workspaceId: string;
  methodologyKey: string;
  actorId: string;
  input: UpdatePhaseConfigInput;
}

/**
 * Actualiza la configuración de fases del proyecto (fase actual + gating).
 * Valida que `currentPhaseKey` (si se setea) pertenezca a la metodología.
 */
export class UpdatePhaseConfig {
  constructor(private readonly deps: UpdatePhaseConfigDeps) {}

  async execute(request: UpdatePhaseConfigRequest) {
    const input = updatePhaseConfigSchema.parse(request.input);

    if (input.currentPhaseKey !== undefined && input.currentPhaseKey !== null) {
      const known = getMethodologyPhases(request.methodologyKey).some(
        (p) => p.phaseKey === input.currentPhaseKey
      );
      if (!known) {
        throw new UserFacingError(
          "La fase indicada no pertenece a la metodología.",
          400
        );
      }
    }

    const previous = await this.deps.phaseTrackingRepository.getPhaseConfig(
      request.workspaceId
    );

    const result = await this.deps.phaseTrackingRepository.upsertPhaseConfig(
      request.workspaceId,
      {
        methodologyKey: request.methodologyKey,
        ...(input.currentPhaseKey !== undefined
          ? { currentPhaseKey: input.currentPhaseKey }
          : {}),
        ...(input.requirePhaseStarted !== undefined
          ? { requirePhaseStarted: input.requirePhaseStarted }
          : {}),
      }
    );

    await this.deps.auditRepository.record({
      workspaceId: request.workspaceId,
      actorId: request.actorId,
      action: "phase_config.update",
      entity: "phase_config",
      entityId: request.workspaceId,
      before: previous
        ? {
            currentPhaseKey: previous.currentPhaseKey,
            requirePhaseStarted: previous.requirePhaseStarted,
          }
        : null,
      after: {
        currentPhaseKey: result.currentPhaseKey,
        requirePhaseStarted: result.requirePhaseStarted,
      },
    });

    return result;
  }
}
