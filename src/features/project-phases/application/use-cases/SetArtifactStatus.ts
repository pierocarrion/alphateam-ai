import type { IPhaseTrackingRepository } from "../../domain/repositories";
import type { IAuditRepository } from "@/features/project-settings/domain/repositories";
import { UserFacingError } from "@/server/lib/errors";
import {
  setArtifactStatusSchema,
  type SetArtifactStatusInput,
} from "../../application/schemas";
import { getMethodologyPhases } from "../../domain/visualization";
import type { ArtifactStatus } from "../../domain/entities";

export interface SetArtifactStatusDeps {
  phaseTrackingRepository: IPhaseTrackingRepository;
  auditRepository: IAuditRepository;
}

export interface SetArtifactStatusRequest {
  workspaceId: string;
  methodologyKey: string;
  artifactKey: string;
  actorId: string;
  input: SetArtifactStatusInput;
}

export class SetArtifactStatus {
  constructor(private readonly deps: SetArtifactStatusDeps) {}

  async execute(request: SetArtifactStatusRequest) {
    const input = setArtifactStatusSchema.parse(request.input);

    const known = getMethodologyPhases(request.methodologyKey)
      .flatMap((p) => p.items)
      .some((i) => i.key === request.artifactKey);
    if (!known) {
      throw new UserFacingError("El artefacto no pertenece a la metodología.", 400);
    }

    const existingArtifacts = await this.deps.phaseTrackingRepository.listArtifacts(
      request.workspaceId
    );
    const existing = existingArtifacts.find((a) => a.artifactKey === request.artifactKey) ?? null;

    // Localiza phaseKey desde el catálogo.
    const phase = getMethodologyPhases(request.methodologyKey).find((p) =>
      p.items.some((i) => i.key === request.artifactKey)
    );
    if (!phase) throw new UserFacingError("Artefacto no encontrado en la metodología.", 400);

    const now = new Date();
    const existingStarted = existing?.startedAt ? new Date(existing.startedAt) : null;
    const patch: {
      status?: ArtifactStatus;
      startedAt?: Date;
      completedAt?: Date | null;
    } = {};

    if (input.status) {
      patch.status = input.status as ArtifactStatus;
      if (input.status === "in_progress") patch.startedAt = existingStarted ?? now;
      if (input.status === "done") {
        patch.startedAt = existingStarted ?? now;
        patch.completedAt = now;
      }
      if (input.status === "pending" || input.status === "skipped") patch.completedAt = null;
    }

    const result = await this.deps.phaseTrackingRepository.upsertArtifact(
      request.workspaceId,
      {
        methodologyKey: request.methodologyKey,
        phaseKey: phase.phaseKey,
        artifactKey: request.artifactKey,
        ...patch,
      }
    );

    await this.deps.auditRepository.record({
      workspaceId: request.workspaceId,
      actorId: request.actorId,
      action: "artifact.update_status",
      entity: "artifact",
      entityId: request.artifactKey,
      before: existing ? { status: existing.status } : null,
      after: { status: result.status },
    });

    return result;
  }
}
