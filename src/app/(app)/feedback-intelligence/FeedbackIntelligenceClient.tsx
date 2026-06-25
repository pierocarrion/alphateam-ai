"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/cn";
import { fetchJson } from "@/shared/lib/api";
import { Button, Icon, type IconName } from "@/shared/ui";

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
      else setInsightReason(data.reason ?? "Sin datos suficientes.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos generar el análisis.");
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
            <h1 className="font-display text-[20px] leading-none text-ink">Feedback Intelligence</h1>
            <p className="text-[12px] text-ink-3">
              Anónimo · Analizado por IA · {metrics.count} respuesta{metrics.count === 1 ? "" : "s"}
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
            Nueva campaña
          </Button>
        </div>
      </header>

      <div className="flex-1 px-5 py-5 lg:px-7">
        {/* Privacy banner */}
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <Icon name="lock" size={18} color="var(--color-sage)" />
          <p className="flex-1 text-[12.5px] leading-relaxed text-ink-2">
            Todas las respuestas son <b className="text-ink">completamente anónimas</b>. La IA
            elimina cualquier dato identificable antes de mostrar resúmenes. Los agregados se
            publican solo con un mínimo de {minForInsight} respuestas.
          </p>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metricKeys.map((m) => (
            <MetricCard
              key={m.key}
              label={m.label}
              value={metrics[m.key]}
              goodWhenHigh={m.goodWhenHigh}
            />
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          {/* Trend chart */}
          <div className="rounded-card border border-line bg-surface p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                Tendencia · últimos {windowDays} días
              </p>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 text-ink-2">
                  <span className="h-2 w-2 rounded-full bg-accent" /> Sentimiento
                </span>
                <span className="flex items-center gap-1.5 text-ink-2">
                  <span className="h-2 w-2 rounded-full bg-sage" /> Compromiso
                </span>
              </div>
            </div>
            <TrendChart trend={trend} />
          </div>

          {/* Emotions */}
          <div className="rounded-card border border-line bg-surface p-5">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
              Emociones predominantes
            </p>
            {emotions.length === 0 ? (
              <p className="text-[13px] text-ink-3">Aún no hay datos suficientes.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {emotions.slice(0, 6).map((e) => (
                  <EmotionBar key={e.emotion} emotion={e.emotion} count={e.count} max={emotions[0].count} />
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
              <h2 className="font-display text-[17px] text-ink">Análisis ejecutivo de IA</h2>
            </div>
            <Button size="sm" variant="ghost" icon="spark" onClick={generateInsight} disabled={generating}>
              {generating ? "Analizando…" : insight ? "Refrescar" : "Generar"}
            </Button>
          </div>

          {!insight && !insightReason && !generating && (
            <p className="text-[13px] text-ink-3">
              Genera un resumen ejecutivo neutro con temas, alertas tempranas y recomendaciones
              priorizadas. Disponible a partir de {minForInsight} respuestas anónimas.
            </p>
          )}
          {generating && (
            <p className="text-[13px] text-ink-3">Analizando patrones y redactando resumen anónimo…</p>
          )}
          {insightReason && !insight && (
            <p className="text-[13px] text-ink-2">{insightReason}</p>
          )}
          {insight && <InsightView insight={insight} />}
        </div>

        {/* Campaigns */}
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[17px] text-ink">Campañas</h2>
            <span className="text-[12px] text-ink-3">{campaigns.length} total</span>
          </div>
          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line-2 bg-surface p-8 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-bg-2">
                <Icon name="pulse" size={20} color="var(--color-ink-3)" />
              </div>
              <div className="max-w-sm">
                <p className="text-[14.5px] font-bold text-ink">Aún no hay campañas</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
                  Crea un pulso anónimo para empezar a recibir feedback. Las
                  métricas y el análisis de IA aparecen aquí cuando lleguen las
                  primeras respuestas.
                </p>
              </div>
              <Button size="sm" icon="plus" onClick={() => setShowNew(true)}>
                Crear tu primera campaña
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {campaigns.map((c) => (
                <CampaignRowCard key={c.id} campaign={c} onClosed={() => window.location.reload()} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <NewCampaignModal
          presets={presets}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            toast.success("Campaña creada.");
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
}: {
  label: string;
  value: number;
  goodWhenHigh: boolean;
}) {
  const v = goodWhenHigh ? value : 100 - value;
  const color = v >= 70 ? "var(--color-sage)" : v >= 45 ? "var(--color-accent)" : "var(--color-glow)";
  const status = v >= 70 ? "Saludable" : v >= 45 ? "Atención" : "Crítico";
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

function TrendChart({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-[13px] text-ink-3">
        Aún no hay suficientes datos para graficar.
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

const EMOTION_META: Record<string, { label: string; color: string }> = {
  motivated: { label: "Motivado", color: "var(--color-sage)" },
  committed: { label: "Comprometido", color: "var(--color-accent)" },
  stressed: { label: "Estresado", color: "var(--color-glow)" },
  uncertain: { label: "Incierto", color: "#9FB8E0" },
  disconnected: { label: "Desconectado", color: "#c98a8a" },
  burned_out: { label: "Burnout", color: "#e07a7a" },
  neutral: { label: "Neutral", color: "var(--color-ink-3)" },
};

function EmotionBar({ emotion, count, max }: { emotion: string; count: number; max: number }) {
  const meta = EMOTION_META[emotion] ?? { label: emotion, color: "var(--color-ink-3)" };
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="text-ink-2">{meta.label}</span>
        <span className="font-semibold text-ink-3">{count}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-line-2">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
      </div>
    </div>
  );
}

function InsightView({ insight }: { insight: Insight }) {
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
            Alertas tempranas
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
        <InsightList title="Temas recurrentes" items={insight.themes} dot="var(--color-accent)" />
        <InsightList title="Preocupaciones" items={insight.concerns} dot="var(--color-glow)" />
        <InsightList title="Fortalezas" items={insight.strengths} dot="var(--color-sage)" />
      </div>

      {insight.recommendations.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
            Recomendaciones accionables
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

function CampaignRowCard({ campaign, onClosed }: { campaign: CampaignRow; onClosed: () => void }) {
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
      toast.error(err instanceof Error ? err.message : "No pudimos cerrar la campaña.");
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
          {campaign.kind} · {campaign.cadence} · {campaign.responses} respuesta{campaign.responses === 1 ? "" : "s"}
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
          Cerrar
        </Button>
      )}
    </div>
  );
}

function NewCampaignModal({
  presets,
  onClose,
  onCreated,
}: {
  presets: { kind: string; title: string; cadence: string }[];
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
      toast.error(err instanceof Error ? err.message : "No pudimos crear la campaña.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-line-2 bg-bg-2 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-[20px] text-ink">Nueva campaña</h3>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-3 hover:text-ink">
            <Icon name="close" size={18} />
          </button>
        </div>

        <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
          Plantilla
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
          Título (opcional)
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={presets.find((p) => p.kind === kind)?.title}
          className="mb-5 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] text-ink outline-none placeholder:text-ink-3 focus:border-sage"
        />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button icon="arrow" onClick={create} disabled={creating}>
            {creating ? "Creando…" : "Crear campaña"}
          </Button>
        </div>
      </div>
    </div>
  );
}
