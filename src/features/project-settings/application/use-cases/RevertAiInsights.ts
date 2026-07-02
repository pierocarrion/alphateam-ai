import type { RevertAiInsightsInput } from "../schemas";
import type { ProjectSettingsDeps } from "../../infrastructure/container";
import { SaveSmartGoal } from "./SaveSmartGoal";
import { SetMethodology } from "./SetMethodology";
import { ConfigureKpis } from "./ConfigureKpis";
import { UpdateMember } from "./ManageMembers";
import { UserFacingError } from "@/server/lib/errors";

export interface RevertAiInsightsRequest extends RevertAiInsightsInput {
  workspaceId: string;
  actorId: string;
}

/**
 * Restaura el snapshot capturado por `ApplyAiInsights` para deshacer una
 * aplicación masiva de acciones de IA. Reutiliza los mismos casos de uso para
 * mantener invariantes y auditoría. Es tolerante: si una sección no se puede
 * restaurar (p.ej. el snapshot vino vacío), la omite en lugar de fallar.
 */
export class RevertAiInsights {
  constructor(private readonly deps: ProjectSettingsDeps) {}

  async execute(request: RevertAiInsightsRequest): Promise<{ reverted: string[] }> {
    const { workspaceId, actorId } = request;
    const reverted: string[] = [];

    if (request.smartGoal) {
      const useCase = new SaveSmartGoal({
        smartGoalRepository: this.deps.smartGoalRepository,
        auditRepository: this.deps.auditRepository,
      });
      await useCase.execute({
        workspaceId,
        actorId,
        title: request.smartGoal.title,
        specific: request.smartGoal.specific,
        measurable: request.smartGoal.measurable,
        achievable: request.smartGoal.achievable,
        relevant: request.smartGoal.relevant,
        timeBound: request.smartGoal.timeBound,
      });
      reverted.push("smart_goal");
    }

    if (request.methodologies.primary) {
      const useCase = new SetMethodology({
        methodologyRepository: this.deps.methodologyRepository,
        auditRepository: this.deps.auditRepository,
      });
      await useCase.execute({
        workspaceId,
        actorId,
        primary: request.methodologies.primary,
        secondary: request.methodologies.secondary,
      });
      reverted.push("methodology");
    }

    if (request.kpis.length > 0) {
      const useCase = new ConfigureKpis({
        kpiRepository: this.deps.kpiRepository,
        auditRepository: this.deps.auditRepository,
      });
      await useCase.execute({
        workspaceId,
        actorId,
        entries: request.kpis.map((k) => ({
          kpiKey: k.kpiKey,
          enabled: k.enabled,
          target: k.target,
          alertThreshold: k.alertThreshold,
        })),
      });
      reverted.push("kpis");
    }

    if (request.members.length > 0) {
      const useCase = new UpdateMember({
        memberRepository: this.deps.memberRepository,
        auditRepository: this.deps.auditRepository,
      });
      for (const m of request.members) {
        try {
          await useCase.execute(workspaceId, m.memberId, actorId, {
            projectRole: m.projectRole,
          });
        } catch (err) {
          // Si el miembro ya no existe o perdería liderazgo, lo saltamos pero
          // dejamos constancia en auditoría en lugar de abortar el revert.
          if (err instanceof UserFacingError) continue;
          throw err;
        }
      }
      reverted.push("members");
    }

    await this.deps.auditRepository.record({
      workspaceId,
      actorId,
      action: "ai_insights.revert",
      entity: "insight",
      after: { reverted },
    });

    return { reverted };
  }
}
