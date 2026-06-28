"use client";

import { useState } from "react";
import { useUpdatePhaseConfig } from "../hooks";
import type { PhaseView } from "../../domain/repositories";

interface PhaseConfigCardProps {
  workspaceId: string;
  requirePhaseStarted: boolean;
  currentPhaseKey: string | null;
  phases: PhaseView[];
}

/**
 * Tarjeta de configuración del seguimiento de fases.
 * Permite (1) activar/desactivar el gateo "requerir fase iniciada para editar
 * artefactos" y (2) elegir la fase actual del proyecto (visible globalmente).
 */
export function PhaseConfigCard({
  workspaceId,
  requirePhaseStarted,
  currentPhaseKey,
  phases,
}: PhaseConfigCardProps) {
  const updateConfig = useUpdatePhaseConfig(workspaceId);
  const [requireStarted, setRequireStarted] = useState(requirePhaseStarted);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="font-display text-base text-ink">Configuración de fases</h3>
      <p className="mt-0.5 text-[12px] text-ink-3">
 Define cómo el equipo avanza y edita los artefactos.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex items-start justify-between gap-3 rounded-xl border border-line-2 bg-surface-2 px-3 py-2.5">
          <span className="flex flex-col">
            <span className="text-[13px] font-semibold text-ink">
              Requerir fase iniciada
            </span>
            <span className="mt-0.5 text-[11.5px] text-ink-3">
              Los artefactos solo se editan cuando su fase está iniciada.
            </span>
          </span>
          <input
            type="checkbox"
            checked={requireStarted}
            onChange={(e) => {
              setRequireStarted(e.target.checked);
              updateConfig.mutate({ requirePhaseStarted: e.target.checked });
            }}
            disabled={updateConfig.isPending}
            className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
          />
        </label>

        <label className="flex flex-col gap-1 rounded-xl border border-line-2 bg-surface-2 px-3 py-2.5">
          <span className="text-[13px] font-semibold text-ink">Fase actual</span>
          <span className="text-[11.5px] text-ink-3">
            La fase que verá el equipo en todo el proyecto.
          </span>
          <select
            value={currentPhaseKey ?? ""}
            onChange={(e) =>
              updateConfig.mutate({
                currentPhaseKey: e.target.value || null,
              })
            }
            disabled={updateConfig.isPending}
            className="mt-2 rounded-lg border border-line-2 bg-bg px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent"
          >
            <option value="">Automática (primera en progreso)</option>
            {phases.map((p) => (
              <option key={p.phaseKey} value={p.phaseKey}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
