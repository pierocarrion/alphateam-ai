"use client";

import { Card } from "@/shared/ui";
import { KPI_CATALOG, type KpiCatalogItem } from "@/features/project-settings/domain/catalog";
import type { ProjectKpi } from "@/features/project-settings/domain/entities";
import {
  computeKpi,
  formatRelativeTime,
  formatValue,
  statusColor,
  statusEmoji,
  statusLabel,
  trendArrow,
  trendLabel,
  type KpiComputed,
} from "../kpi-utils";
import { EmptyState, SectionHeader } from "./primitives";

interface Props {
  kpis: ProjectKpi[];
}

/**
 * "Dashboard de KPIs": vista de solo lectura con valor actual, meta, estado,
 * tendencia, mini-gráfico histórico y última actualización para cada KPI
 * activo del proyecto.
 */
export function KpiDashboard({ kpis }: Props) {
  const active = KPI_CATALOG.map((catalog) => ({
    catalog,
    stored: kpis.find((k) => k.kpiKey === catalog.key),
  })).filter((row) => row.stored?.enabled);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <SectionHeader
        title="Dashboard de KPIs"
        description="Lectura de los indicadores activos. Los valores y tendencias se calculan desde el histórico del proyecto."
        hint={`${active.length} KPI${active.length === 1 ? "" : "s"} en seguimiento.`}
      />

      {active.length === 0 ? (
        <EmptyState
          title="Aún no hay KPIs para mostrar"
          hint="Activa indicadores en la sección superior y guarda los cambios para verlos aquí."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {active.map(({ catalog, stored }) => (
            <KpiDashboardCard
              key={catalog.key}
              catalog={catalog}
              stored={stored!}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function KpiDashboardCard({
  catalog,
  stored,
}: {
  catalog: KpiCatalogItem;
  stored: ProjectKpi;
}) {
  const computed = computeKpi(stored);
  const target = stored.target;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">{catalog.name}</h3>
            <span
              className="rounded-full bg-sage-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sage"
              title="El valor se calcula automáticamente desde los datos del proyecto."
            >
              Automático
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-ink-3">
            Meta: {target != null ? formatValue(target, catalog.unit) : "—"}
          </p>
        </div>
        <StatusIndicator computed={computed} />
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-3">
            Valor actual
          </p>
          <p className="text-2xl font-bold text-ink">
            {formatValue(computed.value, catalog.unit)}
          </p>
        </div>
        <TrendPill computed={computed} />
      </div>

      <Sparkline computed={computed} status={computed.status} />

      <div className="flex items-center justify-between text-[11px] text-ink-3">
        <span>
          {computed.trend !== "unknown" && computed.trendDelta != null
            ? `${trendArrow(computed.trend)} ${trendLabel(computed.trend)} · ${
                computed.trendDelta > 0 ? "+" : ""
              }${Math.round(computed.trendDelta * 10) / 10} pts`
            : "Sin tendencia aún"}
        </span>
        <span>Última actualización: {formatRelativeTime(computed.lastUpdated)}</span>
      </div>
    </div>
  );
}

function StatusIndicator({ computed }: { computed: KpiComputed }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold">
      <span aria-hidden style={{ color: statusColor(computed.status) }}>
        {statusEmoji(computed.status)}
      </span>
      <span className="text-ink-2">{statusLabel(computed.status)}</span>
    </div>
  );
}

function TrendPill({ computed }: { computed: KpiComputed }) {
  if (computed.trend === "unknown") {
    return (
      <span className="rounded-full border border-line-2 px-2 py-0.5 text-[11px] text-ink-3">
        — Sin historia
      </span>
    );
  }
  const color =
    computed.trend === "up"
      ? "var(--color-sage)"
      : computed.trend === "down"
      ? "var(--color-glow)"
      : "var(--color-ink-2)";
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={{
        color,
        borderColor: statusColor(computed.status),
      }}
    >
      {trendArrow(computed.trend)} {trendLabel(computed.trend)}
    </span>
  );
}

function Sparkline({
  computed,
  status,
}: {
  computed: KpiComputed;
  status: KpiComputed["status"];
}) {
  const w = 220;
  const h = 44;
  const points = computed.history.map((s) => s.value);

  if (points.length < 2) {
    return (
      <div className="flex h-11 items-center justify-center rounded-lg border border-dashed border-line-2 text-[11px] text-ink-3">
        Se necesitan al menos 2 snapshots para graficar la tendencia.
      </div>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => [
    i * step,
    h - ((p - min) / range) * h,
  ] as const);
  const d = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c[0].toFixed(1)},${c[1].toFixed(1)}`)
    .join(" ");
  const stroke = statusColor(status);
  const labels = computed.history.map((s) =>
    new Date(s.capturedAt).toLocaleDateString()
  );

  return (
    <div>
      <svg width={w} height={h} className="overflow-visible">
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <circle key={i} cx={c[0]} cy={c[1]} r={2} fill={stroke} />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-ink-3">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}
