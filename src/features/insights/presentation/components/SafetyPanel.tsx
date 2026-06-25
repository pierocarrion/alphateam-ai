"use client";

import type { TeamOverview } from "../types";
import { Panel } from "./Panel";
import { Gauge, LineTrend } from "./charts";
import { t } from "@/i18n/messages";
import { useLocale } from "@/i18n/useLocale";

const STATUS_TITLE_KEY: Record<string, string> = {
  healthy: "insights.safety.status.healthy",
  moderate: "insights.safety.status.moderate",
  critical: "insights.safety.status.critical",
};

const STATUS_HELPER_KEY: Record<string, string> = {
  healthy: "insights.safety.helper.healthy",
  moderate: "insights.safety.helper.moderate",
  critical: "insights.safety.helper.critical",
};

export function SafetyPanel({ overview }: { overview: TeamOverview }) {
  const [locale] = useLocale();
  const s = overview.psychologicalSafety;
  const titleKey = STATUS_TITLE_KEY[s.status];
  const helperKey = STATUS_HELPER_KEY[s.status];
  return (
    <Panel
      kicker={t(locale, "insights.safety.kicker")}
      title={t(locale, "insights.safety.title")}
    >
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <Gauge
          score={s.score}
          status={s.status}
          label={t(locale, titleKey)}
        />
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-2">
            <MiniBar label={t(locale, "insights.safety.factor.survey")} value={s.breakdown.survey} />
            <MiniBar label={t(locale, "insights.safety.factor.feedback")} value={s.breakdown.feedback} />
            <MiniBar label={t(locale, "insights.safety.factor.participation")} value={s.breakdown.participation} />
            <MiniBar label={t(locale, "insights.safety.factor.sentiment")} value={s.breakdown.sentiment} />
          </div>
          <p className="mt-3 text-xs text-ink-3 text-wrap-pretty">
            {t(locale, helperKey)}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
          {t(locale, "insights.safety.trend")}
        </p>
        <LineTrend
          points={s.trend.filter((p) => p.score > 0)}
          ariaLabel={t(locale, "insights.safety.trendAria")}
        />
      </div>
    </Panel>
  );
}

function MiniBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-ink-3">{label}</span>
        <span className="font-semibold text-ink-2">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line-2/40">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, value)}%`,
            background: "var(--color-accent)",
          }}
        />
      </div>
    </div>
  );
}
