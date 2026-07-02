import type { KpiCatalogItem, KpiUnit } from "../domain/catalog";
import type { ProjectKpi } from "../domain/entities";

export type KpiStatus = "green" | "yellow" | "red" | "unknown";
export type KpiTrend = "up" | "down" | "stable" | "unknown";

export interface KpiComputed {
  value: number | null;
  lastUpdated: string | null;
  status: KpiStatus;
  trend: KpiTrend;
  trendDelta: number | null;
  history: { value: number; capturedAt: string }[];
}

const STATUS_COLOR_VAR: Record<KpiStatus, string> = {
  green: "var(--color-sage)",
  yellow: "var(--color-accent)",
  red: "var(--color-glow)",
  unknown: "var(--color-line-2)",
};

export function statusColor(status: KpiStatus): string {
  return STATUS_COLOR_VAR[status];
}

export function statusEmoji(status: KpiStatus): string {
  if (status === "green") return "🟢";
  if (status === "yellow") return "🟡";
  if (status === "red") return "🔴";
  return "⚪";
}

export function statusLabel(status: KpiStatus): string {
  switch (status) {
    case "green":
      return "En meta";
    case "yellow":
      return "En alerta";
    case "red":
      return "Crítico";
    default:
      return "Sin datos";
  }
}

export function trendArrow(trend: KpiTrend): string {
  switch (trend) {
    case "up":
      return "↑";
    case "down":
      return "↓";
    case "stable":
      return "→";
    default:
      return "—";
  }
}

export function trendLabel(trend: KpiTrend): string {
  switch (trend) {
    case "up":
      return "Mejorando";
    case "down":
      return "Empeorando";
    case "stable":
      return "Estable";
    default:
      return "Sin historia";
  }
}

/**
 * Calcula valor actual, estado y tendencia de un KPI a partir de sus
 * snapshots históricos y de la configuración (Meta + Umbral de alerta).
 *
 * Convención (universal para todo el catálogo):
 *   value >= meta       → green
 *   value >= alerta     → yellow
 *   value <  alerta     → red
 */
export function computeKpi(kpi: ProjectKpi): KpiComputed {
  const history = [...kpi.snapshots].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
  );

  if (history.length === 0) {
    return {
      value: null,
      lastUpdated: null,
      status: "unknown",
      trend: "unknown",
      trendDelta: null,
      history,
    };
  }

  const last = history[history.length - 1];
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const value = last.value;

  const target = kpi.target;
  const alert = kpi.alertThreshold;

  let status: KpiStatus = "unknown";
  if (target != null && value >= target) status = "green";
  else if (alert != null && value >= alert) status = "yellow";
  else if (alert != null) status = "red";
  else if (target != null) status = value >= target ? "green" : "yellow";

  let trend: KpiTrend = "unknown";
  let trendDelta: number | null = null;
  if (prev != null) {
    trendDelta = value - prev.value;
    if (trendDelta > 0) trend = "up";
    else if (trendDelta < 0) trend = "down";
    else trend = "stable";
  }

  return {
    value,
    lastUpdated: last.capturedAt,
    status,
    trend,
    trendDelta,
    history,
  };
}

const UNIT_SUFFIX: Record<KpiUnit, string> = {
  percent: "%",
  points: " pts",
  minutes: " min",
  hours: " h",
  days: " d",
  count: "",
};

export function formatValue(value: number | null, unit: KpiUnit): string {
  if (value == null) return "—";
  const rounded =
    Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded}${UNIT_SUFFIX[unit]}`;
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Sin registros";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "Hace un momento";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `Hace ${diffD} d`;
  return date.toLocaleDateString();
}

export function describeFrequency(
  freq: KpiCatalogItem["frequency"]
): string {
  switch (freq) {
    case "daily":
      return "Diario";
    case "weekly":
      return "Semanal";
    case "sprint":
      return "Por sprint";
    case "monthly":
      return "Mensual";
  }
}
