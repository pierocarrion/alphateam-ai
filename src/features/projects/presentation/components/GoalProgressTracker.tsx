"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchJson, ApiError } from "@/shared/lib/api";
import { Avatar, Icon, Alpha, type PersonId } from "@/shared/ui";
import { personIdFromName } from "@/shared/lib/person";
import { SmartCylinder } from "./SmartCylinder";
import type {
  GoalProgressReport,
  Insight,
  TimelineEvent,
} from "@/features/projects/domain/entities/SmartGoal";
import { GoalCopilotChat } from "./GoalCopilotChat";

interface GoalProgressTrackerProps {
  goalId: string;
  goalTitle: string;
  warm: boolean;
}

/**
 * Leader-facing SMART Goal Progress dashboard.
 *
 * Loads the composite progress report from /api/goals/:id/progress and renders:
 * the SMART cylinder, contribution layers + scores, AI insights, risks,
 * prediction, project health and the auto-generated timeline. Polls every 30s
 * for near-real-time updates.
 */
export function GoalProgressTracker({ goalId, goalTitle, warm }: GoalProgressTrackerProps) {
  const [report, setReport] = useState<GoalProgressReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await fetchJson<GoalProgressReport>(
          `/api/goals/${goalId}/progress`
        );
        if (active) {
          setReport(data);
          setError(null);
        }
      } catch (err) {
        if (!active) return;
        const msg =
          err instanceof ApiError
            ? err.message
            : "No pudimos cargar el progreso del objetivo.";
        setError(msg);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [goalId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-ink-3">
        <Alpha size={32} mood="thinking" />
        <span className="ml-3">Analizando el avance del objetivo…</span>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-sm text-ink-2">{error ?? "Algo salió mal."}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs font-semibold text-accent"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="stagger flex flex-col gap-3.5">
      <ProgressHeader title={goalTitle} report={report} />
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[260px_1fr]">
        <div className="card flex flex-col items-center justify-center p-5">
          <SmartCylinder
            progress={report.progress}
            contributions={report.contributions}
          />
          <ContributionLegend report={report} />
        </div>

        <div className="flex flex-col gap-3.5">
          <HealthPanel report={report} />
          <PredictionPanel report={report} />
        </div>
      </div>

      <InsightsPanel insights={report.insights} usedGemini={report.usedGemini} warm={warm} />
      <ContributionsTable report={report} />
      <RisksPanel report={report} />
      <TimelinePanel events={report.timeline} />
      <GoalCopilotChat goalId={goalId} />
    </div>
  );
}

/* ------------------------------- sections ------------------------------- */

function ProgressHeader({
  title,
  report,
}: {
  title: string;
  report: GoalProgressReport;
}) {
  return (
    <div className="card p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
        Objetivo SMART
      </p>
      <h1 className="mt-1 font-display text-[22px] leading-tight text-ink">
        {title}
      </h1>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-3">
        <Stat label="Avance real" value={`${report.progress.goalProgress}%`} />
        <Stat label="Esperado" value={`${report.progress.expectedProgress}%`} />
        <Stat label="Pendiente" value={`${report.progress.pending}%`} />
        <Stat label="Velocidad" value={`${report.progress.velocity}/sem`} />
        <Stat label="Ritmo" value={report.progress.pace} />
        <Stat label="Estado" value={report.progress.status} highlight />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-ink-3">{label}</span>
      <span
        className={highlight ? "font-bold text-accent" : "font-bold text-ink"}
      >
        {value}
      </span>
    </div>
  );
}

function ContributionLegend({ report }: { report: GoalProgressReport }) {
  const members = report.contributions.members.slice(0, 5);
  if (members.length === 0) return null;
  return (
    <div className="mt-4 w-full">
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-3">
        Distribución de aportes
      </p>
      <div className="flex flex-col gap-1.5">
        {members.map((m) => (
          <div key={m.userId} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 flex-none rounded-full"
              style={{ background: m.color }}
            />
            <span className="flex-1 truncate text-ink-2">{m.name}</span>
            <span className="font-bold text-ink">{m.share}%</span>
          </div>
        ))}
        {report.contributions.teamShare > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 flex-none rounded-full"
              style={{ background: "var(--color-surface-3)" }}
            />
            <span className="flex-1 text-ink-3">Equipo (compartido)</span>
            <span className="font-bold text-ink-2">
              {report.contributions.teamShare}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function HealthPanel({ report }: { report: GoalProgressReport }) {
  const h = report.health;
  const ring = ringColor(h.healthScore);
  return (
    <div className="card p-4">
      <SectionTitle>Salud del proyecto</SectionTitle>
      <div className="mt-3 flex items-center gap-4">
        <ScoreRing score={h.healthScore} color={ring} label="Health" />
        <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <Metric label="Confianza de entrega" value={`${h.deliveryConfidence}`} />
          <Metric label="Eficiencia del equipo" value={`${h.teamEfficiency}`} />
          <Metric label="Alineación SMART" value={`${h.goalAlignment}`} />
          <Metric label="Burn rate" value={`${Math.round(h.burnRate * 100)}%`} />
        </div>
      </div>
    </div>
  );
}

function PredictionPanel({ report }: { report: GoalProgressReport }) {
  const p = report.prediction;
  const eta = p.estimatedFinishDate
    ? new Date(p.estimatedFinishDate).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })
    : "—";
  const delta =
    p.daysEarlyOrLate === 0
      ? "justo a tiempo"
      : p.daysEarlyOrLate > 0
        ? `${p.daysEarlyOrLate} días tarde`
        : `${Math.abs(p.daysEarlyOrLate)} días antes`;
  return (
    <div className="card p-4">
      <SectionTitle>Predicción de cierre</SectionTitle>
      <div className="mt-3 flex items-center gap-4">
        <ScoreRing score={p.completionProbability} color={ringColor(p.completionProbability)} label="Probabilidad" />
        <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <Metric label="Fecha estimada" value={eta} />
          <Metric label="Riesgo" value={riskLabel(p.riskLevel)} highlight />
          <Metric label="Vs. fecha límite" value={delta} />
          <Metric label="Ventana" value={p.estimatedFinishDate ? "proyectada" : "—"} />
        </div>
      </div>
    </div>
  );
}

function InsightsPanel({
  insights,
  usedGemini,
  warm,
}: {
  insights: Insight[];
  usedGemini: boolean;
  warm: boolean;
}) {
  if (!insights.length) return null;
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <SectionTitle>Observaciones de la IA</SectionTitle>
        {usedGemini && (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
            Gemini
          </span>
        )}
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {insights.map((i) => (
          <li key={i.id} className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5">
              <Alpha size={20} mood={warm ? "calm" : "thinking"} />
            </span>
            <span className="text-ink-2 text-wrap-pretty">{i.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContributionsTable({ report }: { report: GoalProgressReport }) {
  const members = report.contributions.members;
  if (!members.length) return null;
  return (
    <div className="card p-4">
      <SectionTitle>Aportes individuales</SectionTitle>
      <div className="mt-3 flex flex-col divide-y divide-line">
        {members.map((m) => (
          <div key={m.userId} className="flex items-center gap-3 py-2.5">
            <Avatar who={personIdFromName(m.name) as PersonId} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-ink">{m.name}</div>
              <div className="text-[11px] text-ink-3">
                Aporte al avance · {m.share}%
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-5">
              <ScorePill label="Contrib." value={m.contributionScore} />
              <ScorePill label="Entrega" value={m.deliveryScore} />
              <ScorePill label="Calidad" value={m.qualityScore} />
              <ScorePill label="Colab." value={m.collaborationScore} />
              <ScorePill label="Fiab." value={m.reliabilityScore} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RisksPanel({ report }: { report: GoalProgressReport }) {
  if (!report.risks.length) return null;
  return (
    <div className="card p-4">
      <SectionTitle>Detección de riesgos</SectionTitle>
      <ul className="mt-3 flex flex-col gap-2">
        {report.risks.map((r) => (
          <li
            key={r.id}
            className="flex items-start gap-3 rounded-[14px] border border-line p-3"
          >
            <span
              className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full"
              style={{ background: riskBg(r.level) }}
            >
              <Icon name="shield" size={14} color={riskInk(r.level)} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-ink">{r.title}</span>
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase"
                  style={{ background: riskBg(r.level), color: riskInk(r.level) }}
                >
                  {riskLabel(r.level)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-3 text-wrap-pretty">
                {r.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TimelinePanel({ events }: { events: TimelineEvent[] }) {
  if (!events.length) return null;
  return (
    <div className="card p-4">
      <SectionTitle>Línea de tiempo</SectionTitle>
      <ol className="mt-3 flex flex-col gap-3">
        {events.slice(0, 12).map((e) => (
          <li key={e.id} className="flex gap-3">
            <div className="flex w-[58px] flex-none flex-col items-center pt-0.5">
              <span className="text-[11px] font-bold text-ink">
                {new Date(e.date).toLocaleDateString(undefined, {
                  day: "2-digit",
                  month: "short",
                })}
              </span>
              <span
                className="mt-1 h-2 w-2 rounded-full"
                style={{ background: eventColor(e.type) }}
              />
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="text-sm text-ink">{e.title}</div>
              <div className="text-[11px] text-ink-3">
                {e.responsible ? `${e.responsible} · ` : ""}
                {eventLabel(e.type)} · impacto {e.impact}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------- helpers -------------------------------- */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
      {children}
    </p>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10.5px] uppercase tracking-wide text-ink-3">
        {label}
      </span>
      <span className={highlight ? "font-bold text-accent" : "font-bold text-ink"}>
        {value}
      </span>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] text-ink-3">{label}</span>
      <span
        className="text-sm font-bold"
        style={{ color: scoreColor(value) }}
      >
        {value}
      </span>
    </div>
  );
}

function ScoreRing({
  score,
  color,
  label,
}: {
  score: number;
  color: string;
  label: string;
}) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (c * score) / 100;
  return (
    <div className="relative flex h-[68px] w-[68px] flex-none items-center justify-center">
      <svg width={68} height={68} viewBox="0 0 68 68" style={{ display: "block" }}>
        <circle cx={34} cy={34} r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth={5} />
        <circle
          cx={34}
          cy={34}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 34 34)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-[18px] leading-none text-ink">{score}</span>
        <span className="text-[8.5px] uppercase tracking-wide text-ink-3">{label}</span>
      </div>
    </div>
  );
}

function ringColor(score: number): string {
  if (score >= 75) return "#8fe0b0";
  if (score >= 50) return "#ffd28a";
  return "#f5a3a3";
}

function scoreColor(score: number): string {
  if (score >= 80) return "#8fe0b0";
  if (score >= 60) return "var(--color-ink)";
  if (score >= 40) return "#ffd28a";
  return "#f5a3a3";
}

function riskLabel(level: string): string {
  switch (level) {
    case "critical":
      return "Crítico";
    case "high":
      return "Alto";
    case "medium":
      return "Medio";
    default:
      return "Bajo";
  }
}

function riskBg(level: string): string {
  switch (level) {
    case "critical":
      return "rgba(245,163,163,0.22)";
    case "high":
      return "rgba(245,163,163,0.14)";
    case "medium":
      return "rgba(255,210,138,0.16)";
    default:
      return "rgba(143,224,176,0.14)";
  }
}

function riskInk(level: string): string {
  switch (level) {
    case "critical":
    case "high":
      return "#f5a3a3";
    case "medium":
      return "#ffd28a";
    default:
      return "#8fe0b0";
  }
}

function eventColor(type: TimelineEvent["type"]): string {
  switch (type) {
    case "milestone":
      return "#8fe0b0";
    case "task_done":
      return "#7c9cff";
    case "risk":
      return "#f5a3a3";
    case "deadline":
      return "#ffd28a";
    default:
      return "var(--color-ink-3)";
  }
}

function eventLabel(type: TimelineEvent["type"]): string {
  switch (type) {
    case "milestone":
      return "Hito";
    case "task_done":
      return "Tarea completada";
    case "risk":
      return "Riesgo";
    case "deadline":
      return "Fecha límite";
    default:
      return "Evento";
  }
}

void toast; // reserved for future optimistic actions
