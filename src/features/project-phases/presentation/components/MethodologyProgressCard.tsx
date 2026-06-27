"use client";

import Link from "next/link";
import { usePhaseTracking } from "../hooks";

/**
 * Tarjeta resumen del avance de la metodología del proyecto.
 * Pensada para alojarse en /progress y dar visibilidad rápida de la base
 * metodológica, con CTA hacia el seguimiento detallado.
 */
export function MethodologyProgressCard({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading, isError } = usePhaseTracking(workspaceId);
  const summary = data?.summary;

  if (isLoading) {
    return (
      <div className="card flex items-center gap-3 p-5 text-sm text-ink-3">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-2 border-t-accent" />
        Cargando avance de metodología…
      </div>
    );
  }

  if (isError || !summary) {
    return null;
  }

  return (
    <Link
      href="/project/phases"
      className="card flex items-center gap-4 p-5 transition-colors hover:bg-surface-2"
    >
      <span className="text-3xl">{summary.methodologyEmoji}</span>
      <div className="flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3">
          Base metodológica
        </p>
        <p className="font-display text-[16px] text-ink">{summary.methodologyName}</p>
        <p className="text-[12px] text-ink-2">
          {summary.doneArtifacts}/{summary.totalArtifacts} artefactos ·{" "}
          {summary.phases.filter((p) => p.status === "done").length}/{summary.phases.length}{" "}
          {summary.visualization === "linear" ? "fases" : "estaciones"}
        </p>
      </div>
      <div className="text-right">
        <div className="font-display text-2xl text-ink">{summary.progress}%</div>
        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${summary.progress}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
