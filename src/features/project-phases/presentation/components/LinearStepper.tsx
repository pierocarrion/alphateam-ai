"use client";

import { cn } from "@/shared/lib/cn";
import type { PhaseView } from "../../domain/repositories";
import type { PhaseStatus } from "../../domain/entities";

const STATUS_VISUAL: Record<PhaseStatus, { dot: string; ring: string; label: string }> = {
  not_started: { dot: "bg-surface-3", ring: "border-line-2", label: "Por iniciar" },
  in_progress: { dot: "bg-accent", ring: "border-accent", label: "En progreso" },
  done: { dot: "bg-sage", ring: "border-sage", label: "Completado" },
  skipped: { dot: "bg-ink-3", ring: "border-line-2", label: "Omitido" },
};

/**
 * Stepper lineal para metodologías secuenciales (Design Thinking).
 * Muestra las fases como una cascada horizontal con marcadores de estado.
 */
export function LinearStepper({
  phases,
  activePhaseKey,
  onSelect,
}: {
  phases: PhaseView[];
  activePhaseKey: string | null;
  onSelect: (phaseKey: string) => void;
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <ol className="flex min-w-max items-start gap-1">
        {phases.map((phase, idx) => {
          const visual = STATUS_VISUAL[phase.status];
          const isActive = phase.phaseKey === activePhaseKey;
          return (
            <li key={phase.phaseKey} className="flex items-start">
              <button
                type="button"
                onClick={() => onSelect(phase.phaseKey)}
                className="flex flex-col items-center gap-1.5 px-2 text-center"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all",
                    visual.ring,
                    isActive ? "scale-110 shadow-sm" : "",
                    phase.status === "done" ? "text-bg" : "text-ink"
                  )}
                  style={{
                    background: phase.status === "done" ? "var(--color-sage)" : undefined,
                  }}
                >
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", visual.dot)}>
                    {phase.status === "done" ? "✓" : idx + 1}
                  </span>
                </span>
                <span
                  className={cn(
                    "max-w-[88px] text-[11px] font-semibold leading-tight",
                    isActive ? "text-ink" : "text-ink-2"
                  )}
                >
                  {phase.title.replace(/^Fase \d+\s*[—-]\s*/, "")}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-ink-3">
                  {phase.progress}%
                </span>
              </button>
              {idx < phases.length - 1 && (
                <div
                  className={cn(
                    "mt-4 h-0.5 w-8 shrink-0",
                    phase.status === "done" ? "bg-sage" : "bg-line-2"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
