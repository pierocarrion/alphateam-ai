"use client";

import { useMemo, useState } from "react";
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
import { TeamAssistantDrawer } from "./ai-assistant/TeamAssistantDrawer";
import { AssistantFloatingButton } from "./ai-assistant/AssistantFloatingButton";
import { t } from "@/i18n/messages";
import { useLocale } from "@/i18n/useLocale";

export function TeamInsightsDashboard() {
  const [locale] = useLocale();
  const [granularity, setGranularity] = useState<GrowthGranularity>("month");
  const [days, setDays] = useState(90);
  const [filters, setFilters] = useState<TeamInsightsFilters>({});
  const [assistantOpen, setAssistantOpen] = useState(false);
  // Snapshot of the dashboard's "important signals" the leader has already
  // acknowledged by opening the assistant. Compared against the live signature
  // to decide whether the floating button should pulse. Derived without effects
  // (no cascading renders).
  const [seenSignature, setSeenSignature] = useState<string | null>(null);

  const { overview, loading, error, refresh } = useTeamInsights({
    granularity,
    days,
    filters,
    pollMs: 60000,
  });

  // The assistant mirrors the same query the dashboard uses to fetch data, so
  // the model is always grounded in the exact view the leader is looking at.
  const assistantFilterQuery = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("granularity", granularity);
    sp.set("days", String(days));
    if (filters.seniority) sp.set("seniority", filters.seniority);
    if (filters.position) sp.set("position", filters.position);
    if (filters.sentiment) sp.set("sentiment", filters.sentiment);
    if (filters.risk) sp.set("risk", filters.risk);
    if (filters.since) sp.set("since", filters.since);
    return sp.toString();
  }, [granularity, days, filters]);

  // "New important insights" => any critical/warning alert or caution-toned
  // insight. The pulse fires only when the live signature differs from the one
  // captured the last time the leader opened the assistant.
  const importantSignature = useMemo(() => {
    if (!overview) return "";
    const important = [
      ...overview.alerts
        .filter((a) => a.severity === "critical" || a.severity === "warning")
        .map((a) => `alert:${a.id}`),
      ...overview.insights
        .filter((i) => i.tone === "caution")
        .map((i) => `insight:${i.id}`),
    ];
    return important.sort().join("|");
  }, [overview]);

  const hasNewImportantInsights =
    importantSignature.length > 0 && importantSignature !== seenSignature;

  const openAssistant = () => {
    setSeenSignature(importantSignature);
    setAssistantOpen(true);
  };

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
            {t(locale, "insights.dashboard.kicker")}
          </p>
          <h1 className="font-display text-xl font-bold text-ink">
            {t(locale, "insights.dashboard.title")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {overview && (
            <span className="text-[10px] text-ink-3">
              {t(locale, "insights.dashboard.headcount", {
                teamName: overview.teamName,
                count: overview.headcount,
              })}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              refresh();
              toast.success(t(locale, "insights.dashboard.refreshed"));
            }}
            className="rounded-button border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-white/[0.03]"
          >
            {t(locale, "insights.dashboard.refresh")}
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
            message={t(locale, "insights.dashboard.empty")}
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

      {/* AI Team Insights Assistant — contextual co-pilot.
          The dashboard stays in charge; Alpha is just a tap away. */}
      <AssistantFloatingButton
        open={assistantOpen}
        onClick={openAssistant}
        hasNewInsights={hasNewImportantInsights}
      />
      <TeamAssistantDrawer
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        overview={overview}
        filterQuery={assistantFilterQuery}
        daysWindow={days}
      />
    </div>
  );
}
