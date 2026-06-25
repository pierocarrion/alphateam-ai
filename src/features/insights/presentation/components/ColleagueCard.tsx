"use client";

import type { EmployeeWithMetrics, EmotionalState } from "../types";
import { cn } from "@/shared/lib/cn";
import { t } from "@/i18n/messages";
import { useLocale } from "@/i18n/useLocale";

const SENTIMENT_EMOJI: Record<EmotionalState, string> = {
  positive: "\u{1F60A}",
  neutral: "\u{1F610}",
  risk: "\u{2639}\u{FE0F}",
};
const SENTIMENT_KEY: Record<EmotionalState, string> = {
  positive: "insights.card.sentiment.positive",
  neutral: "insights.card.sentiment.neutral",
  risk: "insights.card.sentiment.risk",
};

export function ColleagueCard({
  employee,
  expanded,
  onToggle,
}: {
  employee: EmployeeWithMetrics;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const [locale] = useLocale();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={cn(
        "w-full rounded-card border bg-surface p-4 text-left transition-all hover:border-line-2",
        expanded ? "border-accent" : "border-line"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          {employee.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={employee.photo}
              alt=""
              className="h-11 w-11 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft font-display text-sm font-bold text-accent-ink">
              {(employee.name ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <span
            className="absolute -bottom-0.5 -right-0.5 text-sm"
            title={t(locale, "insights.card.sentimentTitle", {
              label: t(locale, SENTIMENT_KEY[employee.sentiment]),
            })}
          >
            {SENTIMENT_EMOJI[employee.sentiment]}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-ink">
            {employee.name}
          </p>
          <p className="truncate text-xs text-ink-3">
            {employee.position ?? t(locale, "insights.card.team")}
            {employee.seniority ? ` · ${employee.seniority}` : ""}
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-3 text-right">
          <Metric label={t(locale, "insights.card.metric.active")} value={employee.activeTasks} />
          <Metric label={t(locale, "insights.card.metric.done")} value={employee.completedTasks} tone="good" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <MiniMetric label={t(locale, "insights.card.metric.hours")} value={`${Math.round(employee.workedHours)}h`} />
        <MiniMetric label={t(locale, "insights.card.metric.progress")} value={`${Math.round(employee.progressPct)}%`} />
        <MiniMetric
          label={t(locale, "insights.card.metric.learning")}
          value={`${Math.round(employee.learningProgress)}%`}
          tone={
            employee.learningProgress >= 66
              ? "good"
              : employee.learningProgress >= 33
              ? "default"
              : "warn"
          }
        />
      </div>
    </button>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "good";
}) {
  return (
    <div className="flex flex-col">
      <span
        className={cn(
          "font-display text-base font-bold leading-none",
          tone === "good" ? "text-[#5FB87A]" : "text-ink"
        )}
      >
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-[0.12em] text-ink-3">
        {label}
      </span>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warn";
}) {
  return (
    <div className="rounded-button bg-white/[0.03] px-2 py-1.5 text-center">
      <div
        className={cn(
          "font-display text-sm font-bold",
          tone === "good"
            ? "text-[#5FB87A]"
            : tone === "warn"
            ? "text-[#E6B45A]"
            : "text-ink"
        )}
      >
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-[0.1em] text-ink-3">
        {label}
      </div>
    </div>
  );
}
