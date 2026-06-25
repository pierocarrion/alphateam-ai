"use client";

import type { TeamInsightsFilters, GrowthGranularity } from "../types";
import { cn } from "@/shared/lib/cn";
import { t } from "@/i18n/messages";
import { useLocale } from "@/i18n/useLocale";

interface FiltersBarProps {
  filters: TeamInsightsFilters;
  onChange: (filters: TeamInsightsFilters) => void;
  days: number;
  onDaysChange: (days: number) => void;
}

const RANGES = [
  { value: 30, key: "insights.range.30d" as const },
  { value: 90, key: "insights.range.90d" as const },
  { value: 180, key: "insights.range.6m" as const },
  { value: 365, key: "insights.range.1a" as const },
];

const SENTIMENTS = [
  { value: "", label: "Todos", allKey: "insights.sentiment.all" as const },
  { value: "positive", label: "😊", allKey: "" },
  { value: "neutral", label: "😐", allKey: "" },
  { value: "risk", label: "☹️", allKey: "" },
];

export function FiltersBar({
  filters,
  onChange,
  days,
  onDaysChange,
}: FiltersBarProps) {
  const [locale] = useLocale();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface px-3 py-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
        {t(locale, "insights.filters.range")}
      </span>
      <div className="flex gap-1 rounded-button bg-white/[0.03] p-1">
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => onDaysChange(r.value)}
            className={cn(
              "rounded-button px-2 py-0.5 text-[11px] font-semibold transition-colors",
              days === r.value
                ? "bg-accent text-accent-ink"
                : "text-ink-3 hover:text-ink-2"
            )}
          >
            {t(locale, r.key)}
          </button>
        ))}
      </div>

      <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
        {t(locale, "insights.filters.sentiment")}
      </span>
      <div className="flex gap-1 rounded-button bg-white/[0.03] p-1">
        {SENTIMENTS.map((s) => {
          const active =
            (filters.sentiment ?? "") === s.value ||
            (!filters.sentiment && s.value === "");
          return (
            <button
              key={s.value || "all"}
              type="button"
              onClick={() =>
                onChange({
                  ...filters,
                  sentiment: (s.value || undefined) as TeamInsightsFilters["sentiment"],
                })
              }
              className={cn(
                "rounded-button px-2 py-0.5 text-[12px] transition-colors",
                active ? "bg-accent text-accent-ink" : "text-ink-3 hover:text-ink-2"
              )}
              title={s.allKey ? t(locale, s.allKey) : s.label}
            >
              {s.allKey ? t(locale, s.allKey) : s.label}
            </button>
          );
        })}
      </div>

      <label className="ml-2 flex items-center gap-1.5 text-[11px] text-ink-3">
        <span className="uppercase tracking-[0.12em]">
          {t(locale, "insights.filters.seniority")}
        </span>
        <select
          value={filters.seniority ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              seniority: e.target.value || undefined,
            })
          }
          className="rounded-button border border-line bg-surface px-2 py-1 text-xs text-ink"
        >
          <option value="">{t(locale, "insights.seniority.all")}</option>
          <option value="junior">{t(locale, "insights.seniority.junior")}</option>
          <option value="mid">{t(locale, "insights.seniority.mid")}</option>
          <option value="senior">{t(locale, "insights.seniority.senior")}</option>
          <option value="lead">{t(locale, "insights.seniority.lead")}</option>
        </select>
      </label>
    </div>
  );
}

export type { GrowthGranularity };
