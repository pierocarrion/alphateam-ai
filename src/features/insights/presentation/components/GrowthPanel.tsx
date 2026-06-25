"use client";

import type { TeamOverview, GrowthGranularity } from "../types";
import { Panel } from "./Panel";
import { LineTrend } from "./charts";
import { cn } from "@/shared/lib/cn";
import { t } from "@/i18n/messages";
import { useLocale } from "@/i18n/useLocale";

const GRANULARITIES: { value: GrowthGranularity; key: string }[] = [
  { value: "week", key: "insights.growth.granularity.week" },
  { value: "month", key: "insights.growth.granularity.month" },
  { value: "quarter", key: "insights.growth.granularity.quarter" },
  { value: "year", key: "insights.growth.granularity.year" },
];

export function GrowthPanel({
  overview,
  granularity,
  onGranularity,
}: {
  overview: TeamOverview;
  granularity: GrowthGranularity;
  onGranularity: (g: GrowthGranularity) => void;
}) {
  const [locale] = useLocale();
  const g = overview.growth;
  const deltaPositive = g.deltaPct >= 0;
  return (
    <Panel
      kicker={t(locale, "insights.growth.kicker")}
      title={t(locale, "insights.growth.title")}
      action={
        <div className="flex gap-1 rounded-button bg-white/[0.03] p-1">
          {GRANULARITIES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onGranularity(opt.value)}
              className={cn(
                "rounded-button px-2.5 py-1 text-[11px] font-semibold transition-colors",
                granularity === opt.value
                  ? "bg-accent text-accent-ink"
                  : "text-ink-3 hover:text-ink-2"
              )}
            >
              {t(locale, opt.key)}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-3 flex items-baseline gap-2">
        <span className="font-display text-3xl font-bold text-ink">
          {Math.round(g.current)}
        </span>
        <span
          className={cn(
            "text-sm font-semibold",
            deltaPositive ? "text-[#5FB87A]" : "text-[#E0625A]"
          )}
        >
          {deltaPositive ? "+" : ""}
          {g.deltaPct}%
        </span>
        <span className="text-xs text-ink-3">
          {t(locale, "insights.growth.vsPrevious")}
        </span>
      </div>
      <LineTrend
        points={g.points.map((p) => ({ date: p.date, score: p.growthIndex }))}
        height={120}
        ariaLabel={t(locale, "insights.growth.aria")}
      />
    </Panel>
  );
}
