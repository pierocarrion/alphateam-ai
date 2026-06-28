import type { IPhaseTrackingRepository } from "../domain/repositories";
import { UserFacingError } from "@/server/lib/errors";

interface AssertPhaseEditableArgs {
  repository: IPhaseTrackingRepository;
  workspaceId: string;
  methodologyKey: string;
  phaseKey: string;
}

/**
 * Bloquea la edición de artefactos cuando el proyecto exige que la fase esté
 * iniciada. Lanza `UserFacingError` (409) si la fase está `not_started` y el
 * setting `requirePhaseStarted` está activo. No-op en cualquier otro caso.
 */
export async function assertPhaseEditable(
  args: AssertPhaseEditableArgs
): Promise<void> {
  const config = await args.repository.getPhaseConfig(args.workspaceId);
  const requireStarted = config?.requirePhaseStarted ?? true;
  if (!requireStarted) return;

  const phases = await args.repository.listPhases(args.workspaceId, args.methodologyKey);
  const phase = phases.find((p) => p.phaseKey === args.phaseKey);
  if (!phase) return;
  if (phase.status === "not_started") {
    throw new UserFacingError(
      "Inicia la fase antes de editar sus artefactos.",
      409
    );
  }
}
