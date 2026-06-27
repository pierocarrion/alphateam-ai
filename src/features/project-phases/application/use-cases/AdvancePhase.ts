import type { IPhaseTrackingRepository } from "../../domain/repositories";
import type { IAuditRepository } from "@/features/project-settings/domain/repositories";
import type { PhaseStatus } from "../../domain/entities";
import { UserFacingError } from "@/server/lib/errors";
import { advancePhaseSchema, type AdvancePhaseInput } from "../../application/schemas";
import { getMethodologyPhases } from "../../domain/visualization";

export interface AdvancePhaseDeps {
  phaseTrackingRepository: IPhaseTrackingRepository;
  auditRepository: IAuditRepository;
}

export interface AdvancePhaseRequest {
  workspaceId: string;
  methodologyKey: string;
  phaseKey: string;
  actorId: string;
  input: AdvancePhaseInput;
}

export class AdvancePhase {
  constructor(private readonly deps: AdvancePhaseDeps) {}

  async execute(request: AdvancePhaseRequest) {
    const input = advancePhaseSchema.parse(request.input);

    const knownPhases = getMethodologyPhases(request.methodologyKey).map((p) => p.phaseKey);
    if (!knownPhases.includes(request.phaseKey)) {
      throw new UserFacingError("La fase indicada no pertenece a la metodología.", 400);
    }

    const previousList = await this.deps.phaseTrackingRepository.listPhases(
      request.workspaceId,
      request.methodologyKey
    );
    const previous = previousList.find((p) => p.phaseKey === request.phaseKey) ?? null;

    const now = new Date();
    const patch: {
      status?: PhaseStatus;
      notes?: string | null;
      startedAt?: Date | null;
      completedAt?: Date | null;
    } = {};

    if (input.status) {
      patch.status = input.status as PhaseStatus;
      if (input.status === "in_progress" && !previous?.startedAt) patch.startedAt = now;
      if (input.status === "done") {
        if (!previous?.startedAt) patch.startedAt = now;
        patch.completedAt = now;
      }
      if (input.status === "not_started" || input.status === "skipped") {
        patch.completedAt = null;
      }
    }
    if (input.notes !== undefined) patch.notes = input.notes;

    const result = await this.deps.phaseTrackingRepository.upsertPhase(
      request.workspaceId,
      request.methodologyKey,
      request.phaseKey,
      patch
    );

    await this.deps.auditRepository.record({
      workspaceId: request.workspaceId,
      actorId: request.actorId,
      action: "phase.update",
      entity: "phase",
      entityId: request.phaseKey,
      before: previous,
      after: result,
    });

    return result;
  }
}
