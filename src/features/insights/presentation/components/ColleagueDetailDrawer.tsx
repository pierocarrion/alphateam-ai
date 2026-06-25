"use client";

import { useEffect } from "react";
import { useColleagueDetail } from "../hooks/useTeamInsights";
import { LineTrend, StackedBars } from "./charts";
import { PanelSkeleton } from "./Panel";
import { cn } from "@/shared/lib/cn";
import { t } from "@/i18n/messages";
import { useLocale } from "@/i18n/useLocale";

const ACTIVITY_ICON: Record<string, string> = {
  course: "\u{1F4DA}",
  certification: "\u{1F393}",
  task: "\u{2705}",
  meeting: "\u{1F4C5}",
  feedback: "\u{1F4AC}",
};

export function ColleagueDetailDrawer({
  employeeId,
  onClose,
}: {
  employeeId: string | null;
  onClose: () => void;
}) {
  const [locale] = useLocale();
  const { detail, loading } = useColleagueDetail(employeeId);

  useEffect(() => {
    if (!employeeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [employeeId, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-opacity",
        employeeId ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!employeeId}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-surface shadow-2xl transition-transform duration-300",
          employeeId ? "translate-x-0" : "translate-x-full"
        )}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-3">
              {t(locale, "insights.detail.profile")}
            </p>
            <h2 className="font-display text-lg font-semibold text-ink">
              {detail?.employee.name ?? t(locale, "insights.detail.loading")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-button p-2 text-ink-3 hover:bg-white/[0.04] hover:text-ink"
            aria-label={t(locale, "insights.detail.close")}
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading || !detail ? (
            <PanelSkeleton lines={6} />
          ) : (
            <div className="flex flex-col gap-4">
              <section>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
                  {t(locale, "insights.detail.recentActivity")}
                </p>
                <ol className="flex flex-col gap-2">
                  {detail.recentActivity.length === 0 ? (
                    <li className="text-xs text-ink-3">
                      {t(locale, "insights.detail.noActivity")}
                    </li>
                  ) : (
                    detail.recentActivity.map((a, i) => (
                      <li
                        key={`${a.date}-${i}`}
                        className="flex items-start gap-3 rounded-card border border-line p-3"
                      >
                        <span aria-hidden>{ACTIVITY_ICON[a.kind] ?? "•"}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ink-2">{a.title}</p>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-ink-3">
                            {a.kind} · {a.date}
                          </p>
                        </div>
                      </li>
                    ))
                  )}
                </ol>
              </section>

              <section>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
                  {t(locale, "insights.detail.learningEvolution")}
                </p>
                <StackedBars
                  points={detail.learningEvolution.map((p) => ({
                    date: p.date,
                    a: p.completed,
                    b: p.started - p.completed,
                  }))}
                  labels={[
                    t(locale, "insights.detail.label.completed"),
                    t(locale, "insights.detail.label.started"),
                  ]}
                />
              </section>

              <section>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
                  {t(locale, "insights.detail.productivityEvolution")}
                </p>
                <div className="rounded-card border border-line p-3">
                  <LineTrend
                    points={detail.productivityEvolution.map((p) => ({
                      date: p.week,
                      score: p.completed * 20,
                    }))}
                    ariaLabel={t(locale, "insights.detail.completedPerWeekAria")}
                  />
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
                    <Metric label={t(locale, "insights.detail.metric.leadTime")} value={`${detail.productivityEvolution.at(-1)?.leadTimeDays ?? 0}d`} />
                    <Metric label={t(locale, "insights.detail.metric.cycleTime")} value={`${detail.productivityEvolution.at(-1)?.cycleTimeDays ?? 0}d`} />
                    <Metric label={t(locale, "insights.detail.metric.delivery")} value={`${detail.productivityEvolution.at(-1)?.avgDeliveryDays ?? 0}d`} />
                  </div>
                </div>
              </section>

              <section>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
                  {t(locale, "insights.detail.wellbeing")}
                </p>
                <div className="rounded-card border border-line p-3">
                  <LineTrend
                    points={detail.wellbeingHistory.map((p) => ({
                      date: p.date,
                      score: p.satisfaction,
                    }))}
                    color="#5FB87A"
                    ariaLabel={t(locale, "insights.detail.satisfactionAria")}
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2 text-center text-[11px]">
                    <Metric label={t(locale, "insights.detail.metric.participation")} value={`${Math.round(detail.wellbeingHistory.at(-1)?.participation ?? 0)}%`} />
                    <Metric label={t(locale, "insights.detail.metric.sentiment")} value={detail.wellbeingHistory.at(-1)?.sentiment ?? "neutral"} />
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-button bg-white/[0.03] px-2 py-1.5">
      <div className="font-display text-sm font-bold text-ink">{value}</div>
      <div className="text-[9px] uppercase tracking-[0.1em] text-ink-3">
        {label}
      </div>
    </div>
  );
}
