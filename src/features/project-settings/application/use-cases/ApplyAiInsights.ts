import type { ProposedActionInput } from "../schemas";
import type {
  AppliedAction,
  BeforeSnapshot,
} from "../../domain/proposedActions";
import type { ProjectSettingsDeps } from "../../infrastructure/container";
import { SaveSmartGoal } from "./SaveSmartGoal";
import { SetMethodology } from "./SetMethodology";
import { ConfigureKpis } from "./ConfigureKpis";
import { UpdateMember } from "./ManageMembers";
import { UserFacingError } from "@/server/lib/errors";

export interface ApplyAiInsightsRequest {
  workspaceId: string;
  actorId: string;
  actions: ProposedActionInput[];
}

export interface ApplyAiInsightsResult {
  applied: AppliedAction[];
  before: BeforeSnapshot;
}

/**
 * Copiloto de configuración: toma las acciones propuestas por la IA y las
 * ejecuta contra los repositorios del proyecto reutilizando los casos de uso
 * existentes (de modo que se respetan invariantes como "no demover al último
 * líder" y se registran entradas de auditoría por cada cambio).
 *
 * Antes de mutar nada captura un `BeforeSnapshot` que se devuelve al cliente
 * para que pueda deshacer la operación completa con `RevertAiInsights`.
 *
 * Las acciones se ejecutan de forma tolerante: si una falla (p.ej. una clave
 * dejada de existir o una violación de líder), se marca como `ok: false` y se
 * continúa con las demás en lugar de abortar todo el lote.
 */
export class ApplyAiInsights {
  constructor(private readonly deps: ProjectSettingsDeps) {}

  async execute(request: ApplyAiInsightsRequest): Promise<ApplyAiInsightsResult> {
    const { workspaceId, actorId, actions } = request;
    if (actions.length === 0) {
      throw new UserFacingError("Selecciona al menos una acción para aplicar.", 400);
    }

    const before = await this.captureSnapshot(workspaceId);
    const applied: AppliedAction[] = [];
    const touchedMemberIds = new Set<string>();

    // 1. SMART goal: merge de todos los parches en uno solo (last-wins por campo).
    const smartPatches = actions.filter((a) => a.kind === "smart_goal");
    if (smartPatches.length > 0) {
      const merged = this.mergeSmartPatches(smartPatches);
      const base = before.smartGoal ?? {
        title: "Objetivo del proyecto",
        specific: null,
        measurable: null,
        achievable: null,
        relevant: null,
        timeBound: null,
      };
      const next = {
        title: merged.title ?? base.title,
        specific: merged.specific ?? base.specific,
        measurable: merged.measurable ?? base.measurable,
        achievable: merged.achievable ?? base.achievable,
        relevant: merged.relevant ?? base.relevant,
        timeBound: merged.timeBound ?? base.timeBound,
      };
      try {
        const useCase = new SaveSmartGoal({
          smartGoalRepository: this.deps.smartGoalRepository,
          auditRepository: this.deps.auditRepository,
        });
        await useCase.execute({ workspaceId, actorId, ...next });
        for (const a of smartPatches) {
          applied.push({ id: a.id, kind: "smart_goal", label: a.label, ok: true });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "No se pudo actualizar el objetivo.";
        for (const a of smartPatches) {
          applied.push({ id: a.id, kind: "smart_goal", label: a.label, ok: false, error: msg });
        }
      }
    }

    // 2. Metodología: combinar add/remove sobre las secundarias actuales.
    const methodologyActions = actions.filter((a) => a.kind === "methodology");
    if (methodologyActions.length > 0) {
      const currentPrimary = before.methodologies.primary;
      const currentSecondary = new Set(before.methodologies.secondary);
      for (const a of methodologyActions) {
        for (const k of a.addSecondary) currentSecondary.add(k);
        for (const k of a.removeSecondary) currentSecondary.delete(k);
      }
      // Sólo intentamos si hay primaria (SetMethodology exige una).
      if (currentPrimary) {
        try {
          const useCase = new SetMethodology({
            methodologyRepository: this.deps.methodologyRepository,
            auditRepository: this.deps.auditRepository,
          });
          await useCase.execute({
            workspaceId,
            actorId,
            primary: currentPrimary,
            secondary: Array.from(currentSecondary),
          });
          for (const a of methodologyActions) {
            applied.push({ id: a.id, kind: "methodology", label: a.label, ok: true });
          }
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "No se pudo actualizar la metodología.";
          for (const a of methodologyActions) {
            applied.push({ id: a.id, kind: "methodology", label: a.label, ok: false, error: msg });
          }
        }
      } else {
        for (const a of methodologyActions) {
          applied.push({
            id: a.id,
            kind: "methodology",
            label: a.label,
            ok: false,
            error: "El proyecto no tiene metodología principal.",
          });
        }
      }
    }

    // 3. KPIs: merge sobre el estado completo para preservar el resto.
    const kpiActions = actions.filter((a) => a.kind === "kpi");
    if (kpiActions.length > 0) {
      const byKey = new Map(before.kpis.map((k) => [k.kpiKey, { ...k }]));
      for (const a of kpiActions) {
        const existing = byKey.get(a.kpiKey) ?? {
          kpiKey: a.kpiKey,
          enabled: false,
          target: null as number | null,
          alertThreshold: null as number | null,
        };
        byKey.set(a.kpiKey, {
          kpiKey: a.kpiKey,
          enabled: a.enabled,
          target: a.target ?? existing.target,
          alertThreshold: a.alertThreshold ?? existing.alertThreshold,
        });
      }
      try {
        const useCase = new ConfigureKpis({
          kpiRepository: this.deps.kpiRepository,
          auditRepository: this.deps.auditRepository,
        });
        await useCase.execute({
          workspaceId,
          actorId,
          entries: Array.from(byKey.values()).map((k) => ({
            kpiKey: k.kpiKey,
            enabled: k.enabled,
            target: k.target,
            alertThreshold: k.alertThreshold,
          })),
        });
        for (const a of kpiActions) {
          applied.push({
            id: a.id,
            kind: "kpi",
            label: a.label,
            ok: true,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "No se pudo actualizar los KPIs.";
        for (const a of kpiActions) {
          applied.push({ id: a.id, kind: "kpi", label: a.label, ok: false, error: msg });
        }
      }
    }

    // 4. Roles: cada acción reasigna el rol de un miembro concreto.
    const roleActions = actions.filter((a) => a.kind === "role");
    if (roleActions.length > 0) {
      const members = await this.deps.memberRepository.list(workspaceId);
      const useCase = new UpdateMember({
        memberRepository: this.deps.memberRepository,
        auditRepository: this.deps.auditRepository,
      });
      for (const a of roleActions) {
        const target = members.find((m) => m.name === a.memberName && m.status !== "inactive");
        if (!target) {
          applied.push({
            id: a.id,
            kind: "role",
            label: a.label,
            ok: false,
            error: `No encontramos a "${a.memberName}" en el equipo.`,
          });
          continue;
        }
        try {
          await useCase.execute(workspaceId, target.id, actorId, {
            projectRole: a.projectRole,
          });
          touchedMemberIds.add(target.id);
          applied.push({ id: a.id, kind: "role", label: a.label, ok: true });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "No se pudo reasignar el rol.";
          applied.push({ id: a.id, kind: "role", label: a.label, ok: false, error: msg });
        }
      }
    }

    // El snapshot "before" que el cliente reenvía para deshacer sólo debe
    // incluir los miembros que tocamos, para no pisar ediciones ajenas al revertir.
    before.members = before.members.filter((m) => touchedMemberIds.has(m.memberId));

    // KPIs que la IA activó pero que no existían en el snapshot original:
    // los registramos como `enabled: false` para que el revert los desactive.
    if (kpiActions.length > 0) {
      const knownKeys = new Set(before.kpis.map((k) => k.kpiKey));
      for (const a of kpiActions) {
        if (!knownKeys.has(a.kpiKey)) {
          before.kpis.push({
            kpiKey: a.kpiKey,
            enabled: false,
            target: null,
            alertThreshold: null,
          });
        }
      }
    }

    await this.deps.auditRepository.record({
      workspaceId,
      actorId,
      action: "ai_insights.apply",
      entity: "insight",
      after: {
        applied: applied.map((a) => ({ id: a.id, kind: a.kind, ok: a.ok })),
      },
    });

    return { applied, before };
  }

  private mergeSmartPatches(
    patches: Extract<ProposedActionInput, { kind: "smart_goal" }>[]
  ): Record<string, string> {
    const merged: Record<string, string> = {};
    for (const p of patches) {
      for (const [k, v] of Object.entries(p.goal)) {
        if (typeof v === "string" && v.trim()) merged[k] = v.trim();
      }
    }
    return merged;
  }

  private async captureSnapshot(workspaceId: string): Promise<BeforeSnapshot> {
    const [goal, methodologies, kpis, members] = await Promise.all([
      this.deps.smartGoalRepository.get(workspaceId),
      this.deps.methodologyRepository.list(workspaceId),
      this.deps.kpiRepository.list(workspaceId),
      this.deps.memberRepository.list(workspaceId),
    ]);

    const primary = methodologies.find((m) => m.tier === "primary")?.methodologyKey ?? null;
    const secondary = methodologies
      .filter((m) => m.tier === "secondary")
      .map((m) => m.methodologyKey);

    return {
      smartGoal: goal
        ? {
            title: goal.title,
            specific: goal.specific,
            measurable: goal.measurable,
            achievable: goal.achievable,
            relevant: goal.relevant,
            timeBound: goal.timeBound,
          }
        : null,
      methodologies: { primary, secondary },
      kpis: kpis.map((k) => ({
        kpiKey: k.kpiKey,
        enabled: k.enabled,
        target: k.target,
        alertThreshold: k.alertThreshold,
      })),
      members: members.map((m) => ({ memberId: m.id, projectRole: m.projectRole })),
    };
  }
}
