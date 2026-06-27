import type { IPhaseTrackingRepository } from "../../domain/repositories";
import { getMethodologyPhases } from "../../domain/visualization";

export interface SeedPhasesForProjectDeps {
  phaseTrackingRepository: IPhaseTrackingRepository;
}

export interface SeedPhasesForProjectRequest {
  workspaceId: string;
  methodologyKey: string;
}

/**
 * Siembra los ProjectPhaseState iniciales (estado "not_started") para todas
 * las fases/estaciones de la metodología al crear un proyecto. Idempotente:
 * si las fases ya existen no hace nada. No obliga al usuario a completar nada.
 */
export class SeedPhasesForProject {
  constructor(private readonly deps: SeedPhasesForProjectDeps) {}

  async execute(request: SeedPhasesForProjectRequest): Promise<void> {
    const phases = getMethodologyPhases(request.methodologyKey);
    if (phases.length === 0) return;

    await this.deps.phaseTrackingRepository.seedForMethodology(
      request.workspaceId,
      request.methodologyKey,
      phases.map((p) => ({ phaseKey: p.phaseKey }))
    );
  }
}
