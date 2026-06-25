"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/cn";
import { fetchJson } from "@/shared/lib/api";
import { Button, Icon, type IconName } from "@/shared/ui";
import { useLocale } from "@/i18n/useLocale";
import { t, type Locale } from "@/i18n/messages";

interface CampaignRow {
  id: string;
  title: string;
  kind: string;
  cadence: string;
  status: string;
  responses: number;
  createdAt: string;
}

interface Metrics {
  productivity: number;
  psychological_safety: number;
  sentiment_score: number;
  engagement: number;
  turnover_risk: number;
  trust: number;
  collaboration: number;
  count: number;
}

interface MetricKeyDef {
  key: keyof Omit<Metrics, "count">;
  label: string;
  goodWhenHigh: boolean;
}

interface Insight {
  summary: string;
  themes: string[];
  concerns: string[];
  strengths: string[];
  emotions: { emotion: string; count: number }[];
  alerts: { type: string; severity: "low" | "medium" | "high"; detail: string }[];
  recommendations: { priority: "high" | "medium" | "low"; action: string }[];
}

interface TrendPoint {
  day: string;
  sentiment_score: number;
  engagement: number;
  count: number;
}

interface Props {
  leaderName: string;
  campaigns: CampaignRow[];
  metrics: Metrics;
  metricKeys: MetricKeyDef[];
  minForInsight: number;
  presets: { kind: string; title: string; cadence: string }[];
}

export function FeedbackIntelligenceClient({
  campaigns,
  metrics: initialMetrics,
  metricKeys,
  minForInsight,
  presets,
}: Props) {
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [emotions, setEmotions] = useState<{ emotion: string; count: number }[]>([]);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [insightReason, setInsightReason] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [windowDays, setWindowDays] = useState(30);
  const [locale] = useLocale();

  const refresh = async (days: number) => {
    try {
      const data = await fetchJson<{
        metrics: Metrics;
        trend: TrendPoint[];
        emotions: { emotion: string; count: number }[];
      }>(`/api/feedback-intelligence?days=${days}`);
      setMetrics(data.metrics);
      setTrend(data.trend);
      setEmotions(data.emotions);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh(windowDays);
  }, [windowDays]);

  const generateInsight = async () => {
    setGenerating(true);
    setInsight(null);
    setInsightReason(null);
    try {
      const data = await fetchJson<{ insight: Insight | null; reason?: string }>(
        "/api/feedback-intelligence",
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }
      );
      if (data.insight) setInsight(data.insight);
      else setInsightReason(data.reason ?? t(locale, "feedback.insightEmpty"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(locale, "feedback.generateError"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-hide bg-[radial-gradient(110%_50%_at_50%_-10%,#161e2a,var(--color-bg)_60%)]">
      {/* Header */}
      <header className="flex flex-none flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 lg:px-7">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-sage-soft">
            <Icon name="pulse" size={20} color="var(--color-sage)" />
          </div>
          <div>
            <h1 className="font-display text-[20px] leading-none text-ink">{t(locale, "feedback.title")}</h1>
            <p className="text-[12px] text-ink-3">
              {t(locale, metrics.count === 1 ? "feedback.subtitleSingle" : "feedback.subtitle", { count: metrics.count })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-line bg-surface p-0.5 text-[12px]">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setWindowDays(d)}
                className={cn(
                  "rounded-full px-3 py-1 font-semibold transition-colors",
                  windowDays === d ? "bg-accent text-accent-ink" : "text-ink-3 hover:text-ink"
                )}
              >
                {d}d
              </button>
            ))}
          </div>
          <Button size="sm" icon="plus" onClick={() => setShowNew(true)}>
            {t(locale, "feedback.newCampaign")}
          </Button>
        </div>
      </header>

      <div className="flex-1 px-5 py-5 lg:px-7">
        {/* Privacy banner */}
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <Icon name="lock" size={18} color="var(--color-sage)" />
          <p className="flex-1 text-[12.5px] leading-relaxed text-ink-2" dangerouslySetInnerHTML={{ __html: t(locale, "feedback.privacy", { count: minForInsight }) }} />
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metricKeys.map((m) => (
            <MetricCard
              key={m.key}
              label={m.label}
              value={metrics[m.key]}
              goodWhenHigh={m.goodWhenHigh}
              locale={locale}
            />
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          {/* Trend chart */}
          <div className="rounded-card border border-line bg-surface p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                {t(locale, "feedback.trend", { days: windowDays })}
              </p>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 text-ink-2">
                  <span className="h-2 w-2 rounded-full bg-accent" /> {t(locale, "feedback.sentiment")}
                </span>
                <span className="flex items-center gap-1.5 text-ink-2">
                  <span className="h-2 w-2 rounded-full bg-sage" /> {t(locale, "feedback.engagement")}
                </span>
              </div>
            </div>
            <TrendChart trend={trend} locale={locale} />
          </div>

          {/* Emotions */}
          <div className="rounded-card border border-line bg-surface p-5">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
              {t(locale, "feedback.emotions")}
            </p>
            {emotions.length === 0 ? (
              <p className="text-[13px] text-ink-3">{t(locale, "feedback.noEmotions")}</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {emotions.slice(0, 6).map((e) => (
                  <EmotionBar key={e.emotion} emotion={e.emotion} count={e.count} max={emotions[0].count} locale={locale} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI insight */}
        <div className="mt-5 rounded-card border border-line bg-gradient-to-br from-surface to-bg-2 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="spark" size={18} color="var(--color-glow)" />
              <h2 className="font-display text-[17px] text-ink">{t(locale, "feedback.aiAnalysis")}</h2>
            </div>
            <Button size="sm" variant="ghost" icon="spark" onClick={generateInsight} disabled={generating}>
              {generating ? t(locale, "feedback.analyzing") : insight ? t(locale, "feedback.refresh") : t(locale, "feedback.generate")}
            </Button>
          </div>

          {!insight && !insightReason && !generating && (
            <p className="text-[13px] text-ink-3">
              {t(locale, "feedback.aiHint", { count: minForInsight })}
            </p>
          )}
          {generating && (
            <p className="text-[13px] text-ink-3">{t(locale, "feedback.aiWorking")}</p>
          )}
          {insightReason && !insight && (
            <p className="text-[13px] text-ink-2">{insightReason}</p>
          )}
          {insight && <InsightView insight={insight} locale={locale} />}
        </div>

        {/* Campaigns */}
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[17px] text-ink">{t(locale, "feedback.campaigns")}</h2>
            <span className="text-[12px] text-ink-3">{t(locale, "feedback.campaignsTotal", { count: campaigns.length })}</span>
          </div>
          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line-2 bg-surface p-8 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-bg-2">
                <Icon name="pulse" size={20} color="var(--color-ink-3)" />
              </div>
              <div className="max-w-sm">
                <p className="text-[14.5px] font-bold text-ink">{t(locale, "feedback.noCampaignsTitle")}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
                  {t(locale, "feedback.noCampaignsHint")}
                </p>
              </div>
              <Button size="sm" icon="plus" onClick={() => setShowNew(true)}>
                {t(locale, "feedback.createFirst")}
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {campaigns.map((c) => (
                <CampaignRowCard key={c.id} campaign={c} onClosed={() => window.location.reload()} locale={locale} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <NewCampaignModal
          presets={presets}
          locale={locale}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            toast.success(t(locale, "feedback.campaignCreated"));
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MetricCard({
  label,
  value,
  goodWhenHigh,
  locale,
}: {
  label: string;
  value: number;
  goodWhenHigh: boolean;
  locale: Locale;
}) {
  const v = goodWhenHigh ? value : 100 - value;
  const color = v >= 70 ? "var(--color-sage)" : v >= 45 ? "var(--color-accent)" : "var(--color-glow)";
  const status = v >= 70 ? t(locale, "feedback.metric.healthy") : v >= 45 ? t(locale, "feedback.metric.attention") : t(locale, "feedback.metric.critical");
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3">{label}</p>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-[28px] leading-none text-ink">{Math.round(value)}</span>
        <span className="text-[11px] text-ink-3">/100</span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line-2">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {status}
      </div>
    </div>
  );
}

function TrendChart({ trend, locale }: { trend: TrendPoint[]; locale: Locale }) {
  if (trend.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-[13px] text-ink-3">
        {t(locale, "feedback.noTrend")}
      </div>
    );
  }
  const max = 100;
  const w = 100; // viewBox width units
  const h = 180;
  const stepX = trend.length > 1 ? w / (trend.length - 1) : 0;
  const toPath = (key: "sentiment_score" | "engagement") =>
    trend
      .map((p, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(2)},${(h - (p[key] / max) * (h - 20) - 10).toFixed(1)}`)
      .join(" ");

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[180px] w-full">
        {[25, 50, 75].map((g) => (
          <line key={g} x1="0" x2={w} y1={h - (g / max) * (h - 20) - 10} y2={h - (g / max) * (h - 20) - 10} stroke="var(--color-line)" strokeWidth="0.3" />
        ))}
        <path d={toPath("sentiment_score")} fill="none" stroke="var(--color-accent)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
        <path d={toPath("engagement")} fill="none" stroke="var(--color-sage)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-ink-3">
        <span>{trend[0]?.day.slice(5)}</span>
        <span>{trend[trend.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}

const EMOTION_KEYS: Record<string, { key: string; color: string }> = {
  motivated: { key: "feedback.emotion.motivated", color: "var(--color-sage)" },
  committed: { key: "feedback.emotion.committed", color: "var(--color-accent)" },
  stressed: { key: "feedback.emotion.stressed", color: "var(--color-glow)" },
  uncertain: { key: "feedback.emotion.uncertain", color: "#9FB8E0" },
  disconnected: { key: "feedback.emotion.disconnected", color: "#c98a8a" },
  burned_out: { key: "feedback.emotion.burned_out", color: "#e07a7a" },
  neutral: { key: "feedback.emotion.neutral", color: "var(--color-ink-3)" },
};

function EmotionBar({ emotion, count, max, locale }: { emotion: string; count: number; max: number; locale: Locale }) {
  const meta = EMOTION_KEYS[emotion] ?? { key: "", color: "var(--color-ink-3)" };
  const label = meta.key ? t(locale, meta.key) : emotion;
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="text-ink-2">{label}</span>
        <span className="font-semibold text-ink-3">{count}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-line-2">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
      </div>
    </div>
  );
}

function InsightView({ insight, locale }: { insight: Insight; locale: Locale }) {
  const sevColor: Record<string, string> = {
    high: "var(--color-glow)",
    medium: "var(--color-accent)",
    low: "var(--color-sage)",
  };
  const prioColor: Record<string, string> = {
    high: "var(--color-glow)",
    medium: "var(--color-accent)",
    low: "var(--color-sage)",
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14.5px] leading-relaxed text-ink-2">{insight.summary}</p>

      {insight.alerts.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
            {t(locale, "feedback.earlyAlerts")}
          </p>
          <div className="flex flex-col gap-2">
            {insight.alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-xl border border-line bg-bg-2/40 p-3">
                <Icon name="alert" size={16} color={sevColor[a.severity]} />
                <div className="flex-1">
                  <div className="text-[13px] text-ink">{a.detail}</div>
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.12em]" style={{ color: sevColor[a.severity] }}>
                    {a.severity} · {a.type.replace(/_/g, " ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <InsightList title={t(locale, "feedback.recurringThemes")} items={insight.themes} dot="var(--color-accent)" />
        <InsightList title={t(locale, "feedback.concerns")} items={insight.concerns} dot="var(--color-glow)" />
        <InsightList title={t(locale, "feedback.strengths")} items={insight.strengths} dot="var(--color-sage)" />
      </div>

      {insight.recommendations.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
            {t(locale, "feedback.recommendations")}
          </p>
          <div className="flex flex-col gap-2">
            {insight.recommendations
              .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "high" ? -1 : b.priority === "high" ? 1 : a.priority === "medium" ? -1 : 1))
              .map((r, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-xl border border-line bg-bg-2/40 px-3 py-2.5">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ color: prioColor[r.priority], background: "rgba(255,255,255,0.04)" }}>
                    {r.priority}
                  </span>
                  <span className="flex-1 text-[13px] text-ink-2">{r.action}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InsightList({ title, items, dot }: { title: string; items: string[]; dot: string }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">{title}</p>
      {items.length === 0 ? (
        <p className="text-[12px] text-ink-3">—</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] text-ink-2">
              <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full" style={{ background: dot }} />
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CampaignRowCard({ campaign, onClosed, locale }: { campaign: CampaignRow; onClosed: () => void; locale: Locale }) {
  const [closing, setClosing] = useState(false);
  const close = async () => {
    setClosing(true);
    try {
      await fetchJson(`/api/feedback-intelligence/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });
      onClosed();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(locale, "feedback.closeError"));
    } finally {
      setClosing(false);
    }
  };
  const kindMeta: Record<string, { icon: IconName; tint: string }> = {
    pulse: { icon: "pulse", tint: "var(--color-sage)" },
    onboarding: { icon: "plus", tint: "var(--color-accent)" },
    exit: { icon: "back", tint: "var(--color-glow)" },
    contextual: { icon: "spark", tint: "var(--color-glow)" },
    "360": { icon: "people", tint: "var(--color-accent)" },
  };
  const meta = kindMeta[campaign.kind] ?? { icon: "doc", tint: "var(--color-ink-3)" };
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-bg-2/60">
        <Icon name={meta.icon} size={18} color={meta.tint} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-semibold text-ink">{campaign.title}</div>
        <div className="text-[11.5px] text-ink-3">
          {campaign.kind} · {campaign.cadence} · {t(locale, campaign.responses === 1 ? "feedback.responsesSingle" : "feedback.responses", { count: campaign.responses })}
        </div>
      </div>
      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em]",
          campaign.status === "active" ? "bg-sage-soft text-sage" : "bg-white/[0.04] text-ink-3"
        )}
      >
        {campaign.status}
      </span>
      {campaign.status === "active" && (
        <Button size="sm" variant="quiet" onClick={close} disabled={closing}>
          {t(locale, "feedback.close")}
        </Button>
      )}
    </div>
  );
}

function NewCampaignModal({
  presets,
  locale,
  onClose,
  onCreated,
}: {
  presets: { kind: string; title: string; cadence: string }[];
  locale: Locale;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [kind, setKind] = useState(presets[0]?.kind ?? "pulse");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    const preset = presets.find((p) => p.kind === kind) ?? presets[0];
    setCreating(true);
    try {
      await fetchJson("/api/feedback-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: (title.trim() || preset?.title) ?? "Pulso", kind, cadence: preset?.cadence ?? "weekly" }),
      });
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(locale, "feedback.createCampaignError"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-line-2 bg-bg-2 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-[20px] text-ink">{t(locale, "feedback.newCampaign")}</h3>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-3 hover:text-ink">
            <Icon name="close" size={18} />
          </button>
        </div>

        <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
          {t(locale, "feedback.template")}
        </label>
        <div className="mb-4 grid gap-2">
          {presets.map((p) => (
            <button
              key={p.kind}
              onClick={() => setKind(p.kind)}
              className={cn(
                "rounded-2xl border p-3 text-left transition-colors",
                kind === p.kind ? "border-sage bg-sage-soft/30" : "border-line bg-surface hover:bg-surface-2"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold text-ink">{p.title}</span>
                {kind === p.kind && <Icon name="check" size={14} color="var(--color-sage)" />}
              </div>
              <div className="mt-0.5 text-[11.5px] text-ink-3">{p.cadence}</div>
            </button>
          ))}
        </div>

        <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
          {t(locale, "feedback.titleOptional")}
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={presets.find((p) => p.kind === kind)?.title}
          className="mb-5 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] text-ink outline-none placeholder:text-ink-3 focus:border-sage"
        />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t(locale, "common.cancel")}</Button>
          <Button icon="arrow" onClick={create} disabled={creating}>
            {creating ? t(locale, "feedback.creating") : t(locale, "feedback.createCampaign")}
          </Button>
        </div>
      </div>
    </div>
  );
}
