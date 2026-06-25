"use client";

import type { TeamAlert, TeamInsight } from "../types";
import { Panel, EmptyState } from "./Panel";
import { cn } from "@/shared/lib/cn";
import { t } from "@/i18n/messages";
import { useLocale } from "@/i18n/useLocale";

const SEVERITY_STYLE: Record<TeamAlert["severity"], { dot: string; key: string }> =
  {
    critical: { dot: "#E0625A", key: "insights.severity.critical" },
    warning: { dot: "#E6B45A", key: "insights.severity.warning" },
    info: { dot: "#73B8E6", key: "insights.severity.info" },
  };

const TONE_STYLE: Record<TeamInsight["tone"], { emoji: string; key: string }> = {
  celebration: { emoji: "\u{1F389}", key: "insights.tone.celebration" },
  opportunity: { emoji: "\u{1F4A1}", key: "insights.tone.opportunity" },
  caution: { emoji: "\u{26A0}\u{FE0F}", key: "insights.tone.caution" },
};

export function AlertsPanel({ alerts }: { alerts: TeamAlert[] }) {
  const [locale] = useLocale();
  return (
    <Panel
      kicker={t(locale, "insights.alerts.kicker")}
      title={t(locale, "insights.alerts.title")}
    >
      {alerts.length === 0 ? (
        <EmptyState message={t(locale, "insights.alerts.empty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {alerts.map((a) => {
            const style = SEVERITY_STYLE[a.severity];
            return (
              <li
                key={a.id}
                className="flex items-start gap-3 rounded-card border border-line p-3"
              >
                <span
                  className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: style.dot }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-2 text-wrap-pretty">
                    {a.message}
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-ink-3">
                    {t(locale, style.key)}
                    {a.employeeName ? ` · ${a.employeeName}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function InsightsPanel({ insights }: { insights: TeamInsight[] }) {
  const [locale] = useLocale();
  return (
    <Panel
      kicker={t(locale, "insights.insights.kicker")}
      title={t(locale, "insights.insights.title")}
    >
      {insights.length === 0 ? (
        <EmptyState message={t(locale, "insights.insights.empty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {insights.map((insight) => {
            const tone = TONE_STYLE[insight.tone];
            return (
              <li
                key={insight.id}
                className={cn(
                  "flex items-start gap-3 rounded-card border p-3",
                  insight.tone === "caution"
                    ? "border-[#E6B45A]/30 bg-[#E6B45A]/[0.04]"
                    : insight.tone === "celebration"
                    ? "border-[#5FB87A]/30 bg-[#5FB87A]/[0.05]"
                    : "border-line"
                )}
              >
                <span className="text-base leading-none" aria-hidden>
                  {tone.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{insight.title}</p>
                  <p className="mt-0.5 text-xs text-ink-3 text-wrap-pretty">
                    {insight.detail}
                  </p>
                  <span className="mt-1 inline-block text-[10px] uppercase tracking-[0.12em] text-ink-3">
                    {t(locale, tone.key)} · {insight.category}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
