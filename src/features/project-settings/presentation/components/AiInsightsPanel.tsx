"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, Button } from "@/shared/ui";
import type { ProjectAiInsight } from "@/features/project-settings/domain/entities";
import type {
  ProposedAction,
  BeforeSnapshot,
  AppliedAction,
} from "@/features/project-settings/domain/proposedActions";
import { roleName } from "@/features/project-settings/domain/catalog";
import {
  useApplyInsights,
  useRegenerateInsights,
  useRevertInsights,
} from "../hooks";
import type { AiInsightBundle } from "../services";
import { SectionHeader, Spinner, EmptyState, Modal } from "./primitives";

interface Props {
  workspaceId: string;
  insights: ProjectAiInsight[];
}

const TYPE_META: Record<ProjectAiInsight["type"], { label: string; color: string }> = {
  risk: { label: "Riesgo", color: "var(--color-glow)" },
  recommendation: { label: "Recomendación", color: "var(--color-accent)" },
  alert: { label: "Alerta", color: "var(--color-glow)" },
  action: { label: "Acción", color: "var(--color-sage)" },
  metric: { label: "Métrica", color: "var(--color-accent)" },
  workload: { label: "Distribución", color: "var(--color-sage)" },
};

const KIND_META: Record<
  ProposedAction["kind"],
  { label: string; emoji: string; color: string }
> = {
  smart_goal: { label: "Objetivo SMART", emoji: "🎯", color: "var(--color-accent)" },
  methodology: { label: "Metodología", emoji: "🧭", color: "var(--color-sage)" },
  kpi: { label: "KPI", emoji: "📊", color: "var(--color-accent)" },
  role: { label: "Rol", emoji: "👥", color: "var(--color-sage)" },
};

/** Convierte una acción en una descripción corta del cambio concreto. */
function describeChange(action: ProposedAction): string {
  switch (action.kind) {
    case "smart_goal": {
      const fields = Object.entries(action.goal).map(([k]) => k);
      return `Actualiza ${fields.join(", ")} del objetivo.`;
    }
    case "methodology": {
      const parts: string[] = [];
      if (action.addSecondary.length > 0) parts.push(`añade ${action.addSecondary.join(", ")}`);
      if (action.removeSecondary.length > 0) parts.push(`quita ${action.removeSecondary.join(", ")}`);
      return `Metodologías secundarias: ${parts.join(" · ")}.`;
    }
    case "kpi":
      return action.enabled
        ? `Activa el KPI "${action.kpiName}"${action.target != null ? ` (meta ${action.target})` : ""}.`
        : `Desactiva el KPI "${action.kpiName}".`;
    case "role":
      return `Asigna a ${action.memberName} como ${action.roleName}.`;
  }
}

/** Resumen compacto para la lista del modal de confirmación. */
function summarizeLabel(action: ProposedAction): string {
  if (action.kind === "role") {
    return `${action.memberName} → ${action.roleName}`;
  }
  if (action.kind === "kpi") {
    return `${action.kpiName}${action.enabled ? " (activar)" : " (desactivar)"}`;
  }
  if (action.kind === "methodology") {
    const parts: string[] = [];
    if (action.addSecondary.length) parts.push(`+${action.addSecondary.join(",")}`);
    if (action.removeSecondary.length) parts.push(`−${action.removeSecondary.join(",")}`);
    return parts.join(" ");
  }
  return action.label;
}

export function AiInsightsPanel({ workspaceId, insights }: Props) {
  const [bundle, setBundle] = useState<AiInsightBundle | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<ProposedAction[] | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const regenerate = useRegenerateInsights(workspaceId);
  const apply = useApplyInsights(workspaceId);
  const revert = useRevertInsights(workspaceId);

  const actionable = useMemo(
    () => bundle?.proposedActions.filter((a) => !appliedIds.has(a.id)) ?? [],
    [bundle, appliedIds]
  );

  const regenerateInsights = async () => {
    try {
      const res = await regenerate.mutateAsync();
      setBundle(res.bundle);
      setAppliedIds(new Set());
      setSelected(new Set(res.bundle.proposedActions.map((a) => a.id)));
      toast.success("Insights regenerados con IA.");
    } catch {
      /* handled */
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openConfirm = (actions: ProposedAction[]) => {
    if (actions.length === 0) {
      toast.message("Selecciona al menos una acción para aplicar.");
      return;
    }
    setConfirming(actions);
  };

  const runApply = async (actions: ProposedAction[]) => {
    setConfirming(null);
    try {
      const res = await apply.mutateAsync(actions);
      const ok = res.applied.filter((a) => a.ok);
      const failed = res.applied.filter((a) => !a.ok);
      setAppliedIds((prev) => {
        const next = new Set(prev);
        for (const a of ok) next.add(a.id);
        return next;
      });
      setSelected((prev) => {
        const next = new Set(prev);
        for (const a of ok) next.delete(a.id);
        return next;
      });
      showApplyToast(ok, failed, res.before);
    } catch {
      /* handled by provider */
    }
  };

  const showApplyToast = (
    ok: AppliedAction[],
    failed: AppliedAction[],
    before: BeforeSnapshot
  ) => {
    const parts: string[] = [];
    if (ok.length > 0) parts.push(`${ok.length} aplicada${ok.length === 1 ? "" : "s"}`);
    if (failed.length > 0) parts.push(`${failed.length} con error`);
    const headline =
      parts.length === 0
        ? "No se aplicaron cambios."
        : `IA aplicó ${parts.join(" · ")}.`;

    const undo = async () => {
      try {
        await revert.mutateAsync(before);
        setAppliedIds(new Set());
        if (bundle) setSelected(new Set(bundle.proposedActions.map((a) => a.id)));
        toast.success("Cambios deshechos por la IA.");
      } catch {
        toast.error("No pudimos deshacer todos los cambios. Revisa la configuración.");
      }
    };

    toast.success(headline, {
      duration: 12000,
      description:
        failed.length > 0
          ? failed.map((f) => `⚠ ${f.label}: ${f.error ?? "error"}`).join("\n")
          : undefined,
      action: ok.length > 0 ? { label: "Deshacer", onClick: undo } : undefined,
    });
  };

  const selectedCount = actionable.filter((a) => selected.has(a.id)).length;
  const hasActions = actionable.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <SectionHeader
            title="Configuración inteligente IA"
            description="La IA analiza tu objetivo, metodología, equipo y KPIs para generar riesgos, recomendaciones y un plan de acción."
          />
          <Button
            size="sm"
            icon="spark"
            onClick={regenerateInsights}
            disabled={regenerate.isPending}
          >
            {regenerate.isPending ? "Pensando…" : "Generar insights"}
          </Button>
        </div>
        {regenerate.isPending && <Spinner label="La IA está analizando el proyecto…" />}
      </Card>

      {bundle && (
        <Card className="flex flex-col gap-4 p-5">
          <div>
            <h3 className="font-display text-base text-ink">Plan de acción sugerido</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-2">
              {bundle.actionPlan.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ol>
          </div>

          {bundle.suggestedMetrics.length > 0 && (
            <div>
              <h3 className="font-display text-base text-ink">Métricas sugeridas</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {bundle.suggestedMetrics.map((m, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-line bg-surface-2 px-3 py-1 text-[12.5px] text-ink-2"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-display text-base text-ink">Distribución de trabajo recomendada</h3>
            <div className="mt-2 flex flex-col gap-2">
              {bundle.workloadDistribution.map((w, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-40 text-[12.5px] text-ink-2">{w.role}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(4, Math.min(100, w.suggestedShare))}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-[12px] text-ink-3">{w.suggestedShare}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {bundle && (
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeader
              title="Acciones que la IA puede aplicar"
              description="Aplica los cambios con un solo clic. Revisa el resumen antes de confirmar y desmarca lo que no quieras."
              hint="La IA actúa como copiloto: ejecuta, pero tú decides."
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openConfirm(actionable.filter((a) => selected.has(a.id)))}
                disabled={!hasActions || selectedCount === 0 || apply.isPending}
              >
                Aplicar seleccionadas{selectedCount > 0 ? ` (${selectedCount})` : ""}
              </Button>
              <Button
                size="sm"
                icon="spark"
                onClick={() => openConfirm(actionable)}
                disabled={!hasActions || apply.isPending}
              >
                Aplicar todo
              </Button>
            </div>
          </div>

          {!hasActions ? (
            <EmptyState
              title="Todo aplicado"
              hint="Vuelve a generar insights para nuevas recomendaciones accionables."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {actionable.map((action) => {
                const meta = KIND_META[action.kind];
                const isSelected = selected.has(action.id);
                return (
                  <div
                    key={action.id}
                    className="flex flex-col gap-2 rounded-2xl border border-line bg-surface-2 p-3 sm:flex-row sm:items-start"
                  >
                    <label className="flex flex-1 cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(action.id)}
                        className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
                      />
                      <span
                        className="mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: `${meta.color}22`, color: meta.color }}
                      >
                        <span>{meta.emoji}</span>
                        {meta.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-ink">{action.label}</p>
                          <span className="shrink-0 text-[10px] uppercase text-ink-3">
                            {action.confidence}% confianza
                          </span>
                        </div>
                        <p className="mt-0.5 text-[12.5px] text-ink-2">{describeChange(action)}</p>
                        {action.rationale && (
                          <p className="mt-1 text-[12px] italic text-ink-3">{action.rationale}</p>
                        )}
                      </div>
                    </label>
                    <div className="flex shrink-0 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openConfirm([action])}
                        disabled={apply.isPending}
                      >
                        Aplicar con IA
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-3 p-5">
        <SectionHeader title="Insights guardados" description="Última generación de la IA." />
        {insights.length === 0 ? (
          <EmptyState
            title="Sin insights todavía"
            hint="Pulsa «Generar insights» para que la IA analice tu configuración."
          />
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {insights.map((ins) => {
              const meta = TYPE_META[ins.type] ?? TYPE_META.recommendation;
              return (
                <div
                  key={ins.id}
                  className="rounded-2xl border border-line bg-surface-2 p-3"
                  style={{ borderLeft: `3px solid ${meta.color}` }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: `${meta.color}22`, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    {ins.severity && (
                      <span className="text-[10px] uppercase text-ink-3">{ins.severity}</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-ink">{ins.title}</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-2">{ins.detail}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <ConfirmApplyModal
        actions={confirming}
        applying={apply.isPending}
        onCancel={() => setConfirming(null)}
        onConfirm={(finalActions) => runApply(finalActions)}
      />
    </div>
  );
}

function ConfirmApplyModal({
  actions,
  applying,
  onCancel,
  onConfirm,
}: {
  actions: ProposedAction[] | null;
  applying: boolean;
  onCancel: () => void;
  onConfirm: (actions: ProposedAction[]) => void;
}) {
  const [local, setLocal] = useState<Set<string>>(new Set());

  // Resetea la selección local cada vez que se abre con un nuevo lote.
  const signature = actions?.map((a) => a.id).join("|") ?? "";
  const [lastSig, setLastSig] = useState("");
  if (actions && signature !== lastSig) {
    setLastSig(signature);
    setLocal(new Set(actions.map((a) => a.id)));
  }

  if (!actions) return null;

  const toggleLocal = (id: string) => {
    setLocal((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const finalActions = actions.filter((a) => local.has(a.id));

  return (
    <Modal open={Boolean(actions)} onClose={onCancel} title="Revisa los cambios de la IA">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">
          La IA aplicará los siguientes cambios en tu configuración. Desmarca lo que no
          quieras ejecutar.
        </p>
        <ul className="flex flex-col gap-2">
          {actions.map((action) => {
            const meta = KIND_META[action.kind];
            const checked = local.has(action.id);
            return (
              <li
                key={action.id}
                className="flex items-start gap-2 rounded-xl border border-line bg-surface-2 p-2"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleLocal(action.id)}
                  className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span style={{ color: meta.color }}>{meta.emoji}</span>
                    <span className="text-sm font-semibold text-ink">{action.label}</span>
                  </div>
                  <p className="text-[12.5px] text-ink-2">{describeChange(action)}</p>
                  <p className="mt-0.5 text-[12px] text-ink-3">
                    {summarizeLabel(action)}
                    {action.kind === "role" && ` · rol: ${roleName(action.projectRole)}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={applying}>
            Cancelar
          </Button>
          <Button
            size="sm"
            icon="spark"
            onClick={() => onConfirm(finalActions)}
            loading={applying}
            disabled={finalActions.length === 0}
          >
            {applying ? "Aplicando…" : `Confirmar y aplicar (${finalActions.length})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
