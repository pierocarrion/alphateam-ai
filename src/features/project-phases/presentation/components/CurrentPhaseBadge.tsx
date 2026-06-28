"use client";

import Link from "next/link";
import { usePhaseTracking } from "../hooks";

/**
 * Indicador global de la fase actual del proyecto.
 * Se monta en el sidebar para que todo el equipo sepa en qué fase están desde
 * cualquier página. Compacto y tolerante a cargas/errores (no rompe el shell).
 */
export function CurrentPhaseBadge({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading, isError } = usePhaseTracking(workspaceId);
  const summary = data?.summary;

  if (isLoading) {
    return (
      <div className="px-2.5 py-1.5 text-[11px] text-ink-3">Cargando fase…</div>
    );
  }
  if (isError || !summary) return null;

  const current =
    summary.phases.find((p) => p.phaseKey === summary.currentPhaseKey) ?? null;

  return (
    <Link
      href="/project/phases"
      className="mx-1 flex items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-1.5 transition-colors hover:bg-surface-2"
      title="Ver seguimiento de fases"
    >
      <span className="text-base leading-none">{summary.methodologyEmoji}</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[11px] font-bold uppercase tracking-wide text-ink-3">
          Fase actual
        </span>
        <span className="truncate text-[12px] font-semibold text-ink">
          {current?.title ?? "Por definir"}
        </span>
      </div>
      <span className="shrink-0 text-[12px] font-bold text-accent">
        {summary.progress}%
      </span>
    </Link>
  );
}
