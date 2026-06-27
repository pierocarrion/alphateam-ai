"use client";

import { cn } from "@/shared/lib/cn";
import type { PhaseView } from "../../domain/repositories";
import type { PhaseStatus } from "../../domain/entities";

const STATUS_COLOR: Record<PhaseStatus, string> = {
  not_started: "var(--color-surface-3)",
  in_progress: "var(--color-accent)",
  done: "var(--color-sage)",
  skipped: "var(--color-line-2)",
};

/**
 * Anillo cíclico para metodologías iterativas (Scrum).
 * Coloca las estaciones (Roles, Artefactos, Pasos, Métricas) alrededor de un
 * círculo central que muestra el progreso global. Refleja el espíritu iterativo
 * de Scrum (el sprint vuelve a empezar) en lugar de una línea recta.
 */
export function SprintRing({
  phases,
  activePhaseKey,
  onSelect,
  progress,
}: {
  phases: PhaseView[];
  activePhaseKey: string | null;
  onSelect: (phaseKey: string) => void;
  progress: number;
}) {
  const size = 260;
  const radius = 100;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0">
          {/* Anillo base */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-line-2)"
            strokeWidth={2}
            strokeDasharray="4 6"
          />
        </svg>
        {/* Progreso central */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl text-ink">{progress}%</span>
          <span className="text-[11px] uppercase tracking-wide text-ink-3">Sprint</span>
        </div>
        {/* Botones alrededor del anillo */}
        {phases.map((phase, idx) => {
          const angle = (idx / phases.length) * 2 * Math.PI - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          const isActive = phase.phaseKey === activePhaseKey;
          return (
            <button
              key={phase.phaseKey}
              type="button"
              onClick={() => onSelect(phase.phaseKey)}
              className={cn(
                "absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 text-center transition-all",
                isActive ? "scale-110 border-accent bg-accent-soft" : "border-line bg-surface"
              )}
              style={{ left: x, top: y }}
              title={phase.title}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: STATUS_COLOR[phase.status] }}
              />
              <span className="mt-0.5 text-[9px] font-bold text-ink">{phase.progress}%</span>
            </button>
          );
        })}
      </div>
      {/* Leyenda de estaciones */}
      <div className="flex flex-wrap justify-center gap-2">
        {phases.map((phase) => {
          const isActive = phase.phaseKey === activePhaseKey;
          return (
            <button
              key={phase.phaseKey}
              type="button"
              onClick={() => onSelect(phase.phaseKey)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                isActive
                  ? "border-accent bg-accent-soft text-ink"
                  : "border-line text-ink-2 hover:bg-surface-2"
              )}
            >
              {phase.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
