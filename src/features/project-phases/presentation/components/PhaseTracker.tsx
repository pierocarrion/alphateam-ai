"use client";

import { useMemo, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { Spinner, Modal } from "@/features/project-settings/presentation/components/primitives";
import {
  usePhaseTracking,
  useAdvancePhase,
  useToggleArtifact,
  useUpdatePhaseConfig,
} from "../hooks";
import { LinearStepper } from "./LinearStepper";
import { SprintRing } from "./SprintRing";
import { ArtifactModal } from "./ArtifactModal";
import { PhaseConfigCard } from "./PhaseConfigCard";
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

const PHASE_STATUS_LABEL: Record<PhaseStatus, { label: string; dot: string }> = {
  not_started: { label: "Por iniciar", dot: "bg-surface-3" },
  in_progress: { label: "En progreso", dot: "bg-accent" },
  done: { label: "Completada", dot: "bg-sage" },
  skipped: { label: "Omitida", dot: "bg-ink-3" },
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Componente principal de seguimiento de metodología.
 * Renderiza el visualizador adecuado (lineal/cíclico), la lista de artefactos
 * de la fase activa y el progreso global del proyecto.
 */
export function PhaseTracker({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading, isError } = usePhaseTracking(workspaceId);
  const advance = useAdvancePhase(workspaceId);
  const toggle = useToggleArtifact(workspaceId);
  const updateConfig = useUpdatePhaseConfig(workspaceId);

  const summary = data?.summary;
  const phases = useMemo(() => summary?.phases ?? [], [summary]);

  const [activePhaseKey, setActivePhaseKey] = useState<string | null>(null);
  const [openArtifact, setOpenArtifact] = useState<ArtifactView | null>(null);
  const [pendingVisibility, setPendingVisibility] = useState<{
    artifact: ArtifactView;
    next: boolean;
  } | null>(null);

  const activePhase: PhaseView | null = useMemo(() => {
    if (phases.length === 0) return null;
    const explicit = phases.find((p) => p.phaseKey === activePhaseKey);
    if (explicit) return explicit;
    const current = phases.find((p) => p.phaseKey === summary?.currentPhaseKey);
    return current ?? phases[0];
  }, [phases, activePhaseKey, summary?.currentPhaseKey]);

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

  const requireStarted = summary.requirePhaseStarted;
  // La fase activa se puede editar si está iniciada (in_progress/done/skipped)
  // o si el proyecto no exige el gateo.
  const phaseEditable =
    !requireStarted ||
    (activePhase ? activePhase.status !== "not_started" : false);

  const cyclePhaseStatus = (phase: PhaseView) => {
    const next = PHASE_NEXT_STATUS[phase.status];
    if (!next) return;
    advance.mutate({ phaseKey: phase.phaseKey, body: { status: next } });
  };

  const setCurrent = (phaseKey: string) => {
    updateConfig.mutate({ currentPhaseKey: phaseKey });
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
        {summary.currentPhaseKey && (
          <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-ink-3">
            Fase actual ·{" "}
            <span className="font-semibold text-accent">
              {phases.find((p) => p.phaseKey === summary.currentPhaseKey)?.title ?? "—"}
            </span>
          </p>
        )}
      </div>

      {/* Visualizador según metodología */}
      {summary.visualization === "linear" ? (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <LinearStepper
            phases={phases}
            activePhaseKey={activePhase?.phaseKey ?? null}
            currentPhaseKey={summary.currentPhaseKey}
            onSelect={setActivePhaseKey}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <SprintRing
            phases={phases}
            activePhaseKey={activePhase?.phaseKey ?? null}
            currentPhaseKey={summary.currentPhaseKey}
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
              <div className="flex items-center gap-2">
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
                {summary.currentPhaseKey === activePhase.phaseKey && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-accent-ink">
                    Actual
                  </span>
                )}
              </div>
              <h3 className="font-display text-lg text-ink">{activePhase.title}</h3>
              <p className="mt-0.5 text-[12px] text-ink-3">
                {activePhase.progress}% completado
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <button
                type="button"
                onClick={() => cyclePhaseStatus(activePhase)}
                disabled={advance.isPending}
                className="rounded-xl border border-line-2 bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-ink-2 hover:bg-surface"
              >
                {activePhase.status === "not_started" && "Iniciar fase"}
                {activePhase.status === "in_progress" && "Marcar completada"}
                {activePhase.status === "done" && "Reabrir fase"}
                {activePhase.status === "skipped" && "Reanudar fase"}
              </button>
              {summary.currentPhaseKey !== activePhase.phaseKey && (
                <button
                  type="button"
                  onClick={() => setCurrent(activePhase.phaseKey)}
                  disabled={updateConfig.isPending}
                  className="text-[11px] font-semibold text-accent hover:underline disabled:opacity-60"
                >
                  Marcar como fase actual
                </button>
              )}
            </div>
          </div>

          {!phaseEditable && (
            <div className="mt-3 rounded-xl bg-glow-soft/20 px-3 py-2 text-[12px] text-ink-2">
              Inicia la fase para poder editar sus artefactos.
            </div>
          )}

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
                        onClick={() => phaseEditable && setOpenArtifact(artifact)}
                        disabled={!phaseEditable}
                        className="flex flex-col items-start text-left disabled:cursor-not-allowed disabled:opacity-50"
                        title={
                          phaseEditable
                            ? undefined
                            : "Inicia la fase para editar este artefacto"
                        }
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
                            setPendingVisibility({
                              artifact,
                              next: e.target.checked,
                            })
                          }
                          className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                        />
                        Visible
                      </label>
                      <button
                        type="button"
                        onClick={() => setOpenArtifact(artifact)}
                        disabled={!phaseEditable}
                        title={
                          phaseEditable
                            ? undefined
                            : "Inicia la fase para editar este artefacto"
                        }
                        className={cn(
                          "rounded-lg px-3 py-1 text-[12px] font-bold transition-opacity",
                          phaseEditable
                            ? "bg-accent text-bg"
                            : "cursor-not-allowed bg-line-2 text-ink-3 opacity-60"
                        )}
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

      {/* Timeline de fases con tiempos */}
      <PhaseTimeline phases={phases} />

      {/* Configuración de fases */}
      <PhaseConfigCard
        workspaceId={workspaceId}
        requirePhaseStarted={requireStarted}
        currentPhaseKey={summary.currentPhaseKey}
        phases={phases}
      />

      <ArtifactModal
        workspaceId={workspaceId}
        methodologyKey={summary.methodologyKey}
        artifact={openArtifact}
        phaseKey={activePhase?.phaseKey ?? null}
        open={!!openArtifact}
        onClose={() => setOpenArtifact(null)}
      />

      <Modal
        open={!!pendingVisibility}
        onClose={() => setPendingVisibility(null)}
        title={
          pendingVisibility?.next
            ? "Mostrar artefacto"
            : "Ocultar artefacto"
        }
      >
        {pendingVisibility && (
          <div className="flex flex-col gap-4">
            <p className="text-[13.5px] text-ink-2">
              {pendingVisibility.next
                ? `“${pendingVisibility.artifact.name}” volverá a verse en el tablero de la fase.`
                : `Vas a ocultar “${pendingVisibility.artifact.name}”. Desaparecerá de la lista de artefactos, pero no se elimina: su contenido se conserva y puedes volver a mostrarlo con el toggle “Visible”.`}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingVisibility(null)}
                className="rounded-xl px-3 py-2 text-[13px] font-semibold text-ink-3 hover:bg-surface-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={toggle.isPending}
                onClick={() => {
                  toggle.mutate(
                    {
                      artifactKey: pendingVisibility.artifact.artifactKey,
                      body: { visible: pendingVisibility.next },
                    },
                    { onSuccess: () => setPendingVisibility(null) }
                  );
                }}
                className={cn(
                  "rounded-xl px-4 py-2 text-[13px] font-bold transition-opacity",
                  pendingVisibility.next
                    ? "bg-accent text-bg"
                    : "bg-glow text-bg",
                  toggle.isPending && "opacity-60"
                )}
              >
                {toggle.isPending
                  ? "Guardando…"
                  : pendingVisibility.next
                    ? "Mostrar"
                    : "Ocultar"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function PhaseTimeline({ phases }: { phases: PhaseView[] }) {
  if (phases.length === 0) return null;
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="font-display text-base text-ink">Línea de tiempo</h3>
      <p className="mt-0.5 text-[12px] text-ink-3">
        Estado de cada fase y cuándo se inició/completó.
      </p>
      <ol className="mt-4 flex flex-col gap-2.5">
        {phases.map((phase) => {
          const visual = PHASE_STATUS_LABEL[phase.status];
          const started = formatDate(phase.startedAt);
          const completed = formatDate(phase.completedAt);
          return (
            <li
              key={phase.phaseKey}
              className="flex items-start gap-3 rounded-xl border border-line-2 bg-surface-2 px-3 py-2.5"
            >
              <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", visual.dot)} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-x-2">
                  <span className="text-[13px] font-semibold text-ink">
                    {phase.title}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                    {visual.label}
                  </span>
                </div>
                <p className="mt-0.5 text-[11.5px] text-ink-3">
                  {phase.progress}% completado
                  {started && ` · Iniciada ${started}`}
                  {completed && ` · Completada ${completed}`}
                  {!started && !completed && " · Sin comenzar"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
