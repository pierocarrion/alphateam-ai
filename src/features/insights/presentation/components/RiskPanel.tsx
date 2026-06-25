"use client";

import type { TeamOverview } from "../types";
import { Panel, StatChip } from "./Panel";
import { RadialMeter } from "./charts";
import { t } from "@/i18n/messages";
import { useLocale } from "@/i18n/useLocale";

const LEVEL_TITLE_KEY: Record<string, string> = {
  low: "insights.risk.level.low",
  moderate: "insights.risk.level.moderate",
  high: "insights.risk.level.high",
};

const LEVEL_HELPER_KEY: Record<string, string> = {
  low: "insights.risk.helper.low",
  moderate: "insights.risk.helper.moderate",
  high: "insights.risk.helper.high",
};

export function RiskPanel({ overview }: { overview: TeamOverview }) {
  const [locale] = useLocale();
  const r = overview.productivityRisk;
  const titleKey = LEVEL_TITLE_KEY[r.level];
  const helperKey = LEVEL_HELPER_KEY[r.level];
  const factors = [
    { label: t(locale, "insights.risk.factor.overload"), value: r.breakdown.overload },
    { label: t(locale, "insights.risk.factor.overdue"), value: r.breakdown.overdue },
    { label: t(locale, "insights.risk.factor.activityDecline"), value: r.breakdown.activityDecline },
    { label: t(locale, "insights.risk.factor.lowParticipation"), value: r.breakdown.lowParticipation },
    { label: t(locale, "insights.risk.factor.taskMiss"), value: r.breakdown.taskMiss },
    { label: t(locale, "insights.risk.factor.absenteeism"), value: r.breakdown.absenteeism },
  ];
  return (
    <Panel
      kicker={t(locale, "insights.risk.kicker")}
      title={t(locale, "insights.risk.title")}
    >
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <RadialMeter
          score={r.score}
          status={r.level}
          invert
          label={t(locale, titleKey)}
        />
        <div className="flex-1">
          <p className="mb-3 text-xs text-ink-3 text-wrap-pretty">
            {t(locale, helperKey)}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {factors.map((f) => (
              <StatChip
                key={f.label}
                label={f.label}
                value={Math.round(f.value)}
                tone={
                  f.value >= 60 ? "bad" : f.value >= 35 ? "warn" : "good"
                }
              />
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
