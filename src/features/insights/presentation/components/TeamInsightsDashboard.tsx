"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { TeamInsightsFilters, GrowthGranularity } from "../types";
import { useTeamInsights } from "../hooks/useTeamInsights";
import { WorkloadPanel } from "./WorkloadPanel";
import { SafetyPanel } from "./SafetyPanel";
import { RiskPanel } from "./RiskPanel";
import { GrowthPanel } from "./GrowthPanel";
import { SkillsMatrixPanel } from "./SkillsMatrixPanel";
import { AlertsPanel, InsightsPanel } from "./AlertsPanel";
import { ColleagueList } from "./ColleagueList";
import { FiltersBar } from "./FiltersBar";
import { ExportMenu } from "./ExportMenu";
import { PanelSkeleton, EmptyState } from "./Panel";

export function TeamInsightsDashboard() {
  const [granularity, setGranularity] = useState<GrowthGranularity>("month");
  const [days, setDays] = useState(90);
  const [filters, setFilters] = useState<TeamInsightsFilters>({});

  const { overview, loading, error, refresh } = useTeamInsights({
    granularity,
    days,
    filters,
    pollMs: 60000,
  });

  if (error && !overview) {
    return (
      <EmptyState
        message={error}
        icon={<span className="text-2xl">⚠️</span>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
            People Analytics
          </p>
          <h1 className="font-display text-xl font-bold text-ink">
            Team Insights
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {overview && (
            <span className="text-[10px] text-ink-3">
              {overview.teamName} · {overview.headcount} integrantes
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              refresh();
              toast.success("Datos actualizados");
            }}
            className="rounded-button border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-white/[0.03]"
          >
            Actualizar
          </button>
          <ExportMenu days={days} />
        </div>
      </div>

      <FiltersBar
        filters={filters}
        onChange={setFilters}
        days={days}
        onDaysChange={setDays}
      />

      {loading && !overview ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PanelSkeleton lines={4} />
          <PanelSkeleton lines={4} />
          <PanelSkeleton lines={3} />
          <PanelSkeleton lines={3} />
        </div>
      ) : overview ? (
        overview.headcount === 0 ? (
          <EmptyState
            icon={<span className="text-2xl">👥</span>}
            message="Tu workspace todavía no tiene miembros. Invita a tu equipo para que Team Insights empiece a calcular carga, seguridad psicológica, riesgo y crecimiento. Cuando existan tareas, encuestas o actividad de aprendizaje, los paneles se llenarán automáticamente."
          />
        ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <WorkloadPanel overview={overview} />
            <SafetyPanel overview={overview} />
            <RiskPanel overview={overview} />
            <GrowthPanel
              overview={overview}
              granularity={granularity}
              onGranularity={setGranularity}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SkillsMatrixPanel overview={overview} />
            <AlertsPanel alerts={overview.alerts} />
          </div>

          <InsightsPanel insights={overview.insights} />

          <ColleagueList members={overview.members} />
        </>
        )
      ) : null}
    </div>
  );
}
