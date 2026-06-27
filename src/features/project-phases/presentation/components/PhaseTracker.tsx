"use client";

import { useMemo, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { Spinner } from "@/features/project-settings/presentation/components/primitives";
import { usePhaseTracking, useAdvancePhase, useToggleArtifact } from "../hooks";
import { LinearStepper } from "./LinearStepper";
import { SprintRing } from "./SprintRing";
import { ArtifactModal } from "./ArtifactModal";
import type { ArtifactView, PhaseView } from "../../domain/repositories";
import type { ArtifactStatus, PhaseStatus } from "../../domain/entities";

const ARTIFACT_STATUS_LABEL: Record<ArtifactStatus, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-surface-3 text-ink-2" },
  in_progress: { label: "En progreso", cls: "bg-accent-soft text-accent" },
  done: { label: "Hecho", cls: "bg-sage/20 text-sage" },
  skipped: { label: "Omitido", cls: "bg-line-2/40 text-ink-3" },
};

const PHASE_NEXT_STATUS: Record<PhaseStatus, PhaseStatus | null> = {
  not_started: "in_progress",
  in_progress: "done",
  done: "not_started",
  skipped: "in_progress",
};

/**
 * Componente principal de seguimiento de metodología.
 * Renderiza el visualizador adecuado (lineal/cíclico), la lista de artefactos
 * de la fase activa y el progreso global del proyecto.
 */
export function PhaseTracker({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading, isError } = usePhaseTracking(workspaceId);
  const advance = useAdvancePhase(workspaceId);
  const toggle = useToggleArtifact(workspaceId);

  const summary = data?.summary;
  const phases = useMemo(() => summary?.phases ?? [], [summary]);

  const [activePhaseKey, setActivePhaseKey] = useState<string | null>(null);
  const [openArtifact, setOpenArtifact] = useState<ArtifactView | null>(null);

  const activePhase: PhaseView | null = useMemo(() => {
    if (phases.length === 0) return null;
    return phases.find((p) => p.phaseKey === activePhaseKey) ?? phases[0];
  }, [phases, activePhaseKey]);

  if (isLoading) return <Spinner label="Cargando metodología…" />;

  if (isError) {
    return (
      <div className="rounded-2xl border border-glow-soft bg-glow-soft/30 p-5 text-sm text-ink-2">
        No pudimos cargar el avance de la metodología. Inténtalo de nuevo.
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="rounded-2xl border border-dashed border-line-2 p-6 text-center">
        <p className="text-sm font-semibold text-ink-2">
          Este proyecto aún no tiene metodología con contenido detallado.
        </p>
        <p className="mt-1 text-xs text-ink-3">
          Asigna una metodología en la pestaña “Metodología” para activar el seguimiento.
        </p>
      </div>
    );
  }

  const cyclePhaseStatus = (phase: PhaseView) => {
    const next = PHASE_NEXT_STATUS[phase.status];
    if (!next) return;
    advance.mutate({ phaseKey: phase.phaseKey, body: { status: next } });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header con progreso global */}
      <div className="rounded-2xl border border-accent/40 bg-accent-soft p-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{summary.methodologyEmoji}</span>
          <div className="flex-1">
            <h2 className="font-display text-xl text-ink">{summary.methodologyName}</h2>
            <p className="text-[13px] text-ink-2">
              {summary.doneArtifacts} de {summary.totalArtifacts} artefactos completados
            </p>
          </div>
          <div className="text-right">
            <span className="font-display text-2xl text-ink">{summary.progress}%</span>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${summary.progress}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-ink-3">
          No obligatorio · sigue esta base a tu ritmo
        </p>
      </div>

      {/* Visualizador según metodología */}
      {summary.visualization === "linear" ? (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <LinearStepper
            phases={phases}
            activePhaseKey={activePhase?.phaseKey ?? null}
            onSelect={setActivePhaseKey}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <SprintRing
            phases={phases}
            activePhaseKey={activePhase?.phaseKey ?? null}
            onSelect={setActivePhaseKey}
            progress={summary.progress}
          />
        </div>
      )}

      {/* Detalle de la fase activa */}
      {activePhase && (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ink-3">
                {activePhase.kind === "phase"
                  ? "Fase"
                  : activePhase.kind === "steps"
                    ? "Paso del sprint"
                    : activePhase.kind === "roles"
                      ? "Roles"
                      : activePhase.kind === "artifacts"
                        ? "Artefactos"
                        : activePhase.kind === "metrics"
                          ? "Métricas"
                          : "Sección"}
              </p>
              <h3 className="font-display text-lg text-ink">{activePhase.title}</h3>
              <p className="mt-0.5 text-[12px] text-ink-3">
                {activePhase.progress}% completado
              </p>
            </div>
            <button
              type="button"
              onClick={() => cyclePhaseStatus(activePhase)}
              disabled={advance.isPending}
              className="shrink-0 rounded-xl border border-line-2 bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-ink-2 hover:bg-surface"
            >
              {activePhase.status === "not_started" && "Iniciar fase"}
              {activePhase.status === "in_progress" && "Marcar completada"}
              {activePhase.status === "done" && "Reabrir fase"}
              {activePhase.status === "skipped" && "Reanudar fase"}
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {activePhase.artifacts
              .filter((a) => a.visible)
              .map((artifact) => {
                const visual = ARTIFACT_STATUS_LABEL[artifact.status];
                return (
                  <div
                    key={artifact.artifactKey}
                    className="rounded-xl border border-line-2 bg-surface-2"
                  >
                    <div className="flex items-start justify-between gap-3 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setOpenArtifact(artifact)}
                        className="flex flex-col items-start text-left"
                      >
                        <span className="text-[14px] font-semibold text-ink">
                          {artifact.name}
                        </span>
                        {artifact.description && (
                          <span className="mt-0.5 text-[12.5px] text-ink-2">
                            {artifact.description}
                          </span>
                        )}
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        {artifact.mandatory && (
                          <span className="rounded-full bg-glow/15 px-2 py-0.5 text-[10px] font-bold uppercase text-glow">
                            Requerido
                          </span>
                        )}
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                            visual.cls
                          )}
                        >
                          {visual.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-line-2 px-4 py-2">
                      <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-ink-3">
                        <input
                          type="checkbox"
                          checked={artifact.mandatory}
                          onChange={(e) =>
                            toggle.mutate({
                              artifactKey: artifact.artifactKey,
                              body: { mandatory: e.target.checked },
                            })
                          }
                          className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                        />
                        Requerido
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-ink-3">
                        <input
                          type="checkbox"
                          checked={artifact.visible}
                          onChange={(e) =>
                            toggle.mutate({
                              artifactKey: artifact.artifactKey,
                              body: { visible: e.target.checked },
                            })
                          }
                          className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                        />
                        Visible
                      </label>
                      <button
                        type="button"
                        onClick={() => setOpenArtifact(artifact)}
                        className="rounded-lg bg-accent px-3 py-1 text-[12px] font-bold text-bg"
                      >
                        {artifact.status === "done" ? "Editar" : "Completar"}
                      </button>
                    </div>
                  </div>
                );
              })}
            {activePhase.artifacts.filter((a) => a.visible).length === 0 && (
              <p className="rounded-xl border border-dashed border-line-2 px-4 py-3 text-[12.5px] text-ink-3">
                No hay artefactos visibles en esta sección. Actívalos con el toggle “Visible”.
              </p>
            )}
          </div>
        </div>
      )}

      <ArtifactModal
        workspaceId={workspaceId}
        methodologyKey={summary.methodologyKey}
        artifact={openArtifact}
        open={!!openArtifact}
        onClose={() => setOpenArtifact(null)}
      />
    </div>
  );
}
