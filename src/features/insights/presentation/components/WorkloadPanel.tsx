"use client";

import type { TeamOverview } from "../types";
import { Panel, StatChip, EmptyState } from "./Panel";
import { BarList, Heatmap } from "./charts";
import { t } from "@/i18n/messages";
import { useLocale } from "@/i18n/useLocale";

const STATUS_KEY: Record<string, string> = {
  balanced: "insights.workload.status.balanced",
  moderate: "insights.workload.status.moderate",
  overload: "insights.workload.status.overload",
};

export function WorkloadPanel({ overview }: { overview: TeamOverview }) {
  const [locale] = useLocale();
  const { workload } = overview;
  const items = workload.points
    .slice()
    .sort((a, b) => b.occupationPct - a.occupationPct)
    .slice(0, 8);

  const max = Math.max(workload.averageOccupationPct * 1.3, 120, ...items.map((i) => i.occupationPct));

  const heatmapRows = items.map((p) => ({
    label: p.name,
    cells: [{ value: p.occupationPct, label: t(locale, "insights.workload.occupation") }],
  }));

  return (
    <Panel
      kicker={t(locale, "insights.workload.kicker")}
      title={t(locale, "insights.workload.title")}
      action={
        <div className="flex gap-1.5">
          <StatChip
            label={t(locale, "insights.workload.average")}
            value={`${Math.round(workload.averageOccupationPct)}%`}
            tone={
              workload.averageOccupationPct > 120
                ? "bad"
                : workload.averageOccupationPct > 85
                ? "warn"
                : "good"
            }
          />
          <StatChip
            label={t(locale, "insights.workload.overload")}
            value={workload.overloadedCount}
            tone={workload.overloadedCount > 0 ? "bad" : "good"}
          />
        </div>
      }
    >
      {items.length === 0 ? (
        <EmptyState message={t(locale, "insights.workload.empty")} />
      ) : (
        <div className="flex flex-col gap-5">
          <BarList
            items={items.map((p) => ({
              label: p.name,
              value: p.occupationPct,
              max,
              detail: `${p.totalTasks} ${t(locale, "insights.workload.tasks")} · ${t(locale, STATUS_KEY[p.status])}`,
              color:
                p.status === "overload"
                  ? "#E0625A"
                  : p.status === "moderate"
                  ? "#E6B45A"
                  : "#5FB87A",
            }))}
          />
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
              {t(locale, "insights.workload.heatmap")}
            </p>
            <Heatmap rows={heatmapRows} max={120} />
          </div>
        </div>
      )}
    </Panel>
  );
}
