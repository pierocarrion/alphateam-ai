"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/shared/ui";
import { KPI_CATALOG, type KpiCatalogItem } from "@/features/project-settings/domain/catalog";
import type { ProjectKpi } from "@/features/project-settings/domain/entities";
import { useSetKpis } from "../hooks";
import { EmptyState, SectionHeader, Spinner, Toggle } from "./primitives";
import {
  computeKpi,
  describeFrequency,
  formatRelativeTime,
  formatValue,
  statusColor,
  statusEmoji,
  statusLabel,
  trendArrow,
  trendLabel,
} from "../kpi-utils";

interface Props {
  workspaceId: string;
  kpis: ProjectKpi[];
}

interface DraftEntry {
  kpiKey: string;
  enabled: boolean;
  target: string;
  alertThreshold: string;
}

/** Convierte la entrada de texto en número (o null si está vacío). */
function parseNumber(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Valida que, si ambos existen, meta > alerta. */
function entryIsValid(entry: DraftEntry): boolean {
  if (!entry.enabled) return true;
  const target = parseNumber(entry.target);
  const alert = parseNumber(entry.alertThreshold);
  if (target == null || alert == null) return true;
  return target > alert;
}

export function KpiChips({ workspaceId, kpis }: Props) {
  const mutation = useSetKpis(workspaceId);

  const initial = useMemo<Record<string, DraftEntry>>(() => {
    const map: Record<string, DraftEntry> = {};
    for (const kpi of KPI_CATALOG) {
      const existing = kpis.find((k) => k.kpiKey === kpi.key);
      map[kpi.key] = {
        kpiKey: kpi.key,
        enabled: existing?.enabled ?? false,
        target: existing?.target != null ? String(existing.target) : "",
        alertThreshold:
          existing?.alertThreshold != null ? String(existing.alertThreshold) : "",
      };
    }
    return map;
  }, [kpis]);

  const [draft, setDraft] = useState(initial);

  // KPIs cuya tarjeta de configuración está expandida.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const firstActive = Object.values(initial).find((e) => e.enabled);
    return new Set(firstActive ? [firstActive.kpiKey] : []);
  });

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initial),
    [draft, initial]
  );

  const update = (key: string, patch: Partial<DraftEntry>) =>
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const toggleEnabled = (key: string) => {
    const nextEnabled = !draft[key].enabled;
    update(key, { enabled: nextEnabled });
    // Auto-expandir al activar; colapsar al desactivar.
    setExpanded((prev) => {
      const copy = new Set(prev);
      if (nextEnabled) copy.add(key);
      else copy.delete(key);
      return copy;
    });
  };

  const invalidKeys = useMemo(
    () =>
      KPI_CATALOG.filter((k) => !entryIsValid(draft[k.key])).map((k) => k.key),
    [draft]
  );

  const activeCount = Object.values(draft).filter((e) => e.enabled).length;
  const activeKpis = KPI_CATALOG.filter((k) => draft[k.key].enabled);

  const save = async () => {
    if (invalidKeys.length > 0) {
      toast.error("Revisa los KPIs marcados: la Meta debe ser mayor que el Umbral de alerta.");
      // Expandir los inválidos para que el usuario los vea.
      setExpanded((prev) => new Set([...prev, ...invalidKeys]));
      return;
    }
    const entries = Object.values(draft).map((e) => ({
      kpiKey: e.kpiKey,
      enabled: e.enabled,
      target: parseNumber(e.target),
      alertThreshold: parseNumber(e.alertThreshold),
    }));
    try {
      await mutation.mutateAsync(entries);
      toast.success("KPIs actualizados.");
    } catch {
      /* el hook ya notifica el error */
    }
  };

  const toggleAll = (all: boolean) => {
    setDraft((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [k, { ...v, enabled: all }])
      ) as Record<string, DraftEntry>
    );
    if (!all) setExpanded(new Set());
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <SectionHeader
        title="KPIs del proyecto"
        description="Activa los indicadores que el sistema seguirá. El valor se calcula automáticamente; tú solo defines la Meta y el Umbral de alerta."
        hint={`${activeCount} de ${KPI_CATALOG.length} KPIs activos.`}
      />

      {/* Selector de KPIs (chips con switch) */}
      <div className="flex flex-wrap gap-2">
        {KPI_CATALOG.map((kpi) => {
          const e = draft[kpi.key];
          const enabled = e.enabled;
          return (
            <div
              key={kpi.key}
              className={
                "inline-flex items-center gap-2 rounded-full border-[1.5px] py-1.5 pl-3 pr-1.5 text-sm font-semibold transition-all " +
                (enabled
                  ? "border-accent bg-accent-soft text-ink"
                  : "border-line text-ink-2 hover:bg-surface-2")
              }
            >
              <button
                type="button"
                onClick={() => toggleEnabled(kpi.key)}
                aria-pressed={enabled}
                className="uppercase tracking-wide"
              >
                {kpi.name}
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`${enabled ? "Desactivar" : "Activar"} ${kpi.name}`}
                onClick={() => toggleEnabled(kpi.key)}
                className={
                  "inline-flex h-4 w-7 items-center rounded-full transition-colors " +
                  (enabled ? "bg-accent" : "bg-surface-3")
                }
              >
                <span
                  className={
                    "h-3 w-3 rounded-full bg-bg transition-all " +
                    (enabled ? "translate-x-3.5" : "translate-x-0.5")
                  }
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* Estado vacío */}
      {activeCount === 0 ? (
        <EmptyState
          title="Aún no hay KPIs activos"
          hint="Activa al menos un indicador arriba para configurar su Meta y Umbral de alerta."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {activeKpis.map((kpi) => (
            <KpiConfigCard
              key={kpi.key}
              catalog={kpi}
              entry={draft[kpi.key]}
              stored={kpis.find((k) => k.kpiKey === kpi.key)}
              expanded={expanded.has(kpi.key)}
              invalid={invalidKeys.includes(kpi.key)}
              onToggleExpand={() =>
                setExpanded((prev) => {
                  const copy = new Set(prev);
                  if (copy.has(kpi.key)) copy.delete(kpi.key);
                  else copy.add(kpi.key);
                  return copy;
                })
              }
              onChange={(patch) => update(kpi.key, patch)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] text-ink-3">
          <Toggle
            checked={activeCount === KPI_CATALOG.length}
            onChange={toggleAll}
          />
          Todos
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || mutation.isPending || invalidKeys.length > 0}
          className="rounded-button bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-50"
        >
          {mutation.isPending ? "Guardando…" : "Guardar KPIs"}
        </button>
      </div>

      {mutation.isPending && <Spinner label="Actualizando KPIs…" />}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Tarjeta de configuración de un KPI individual                       */
/* ------------------------------------------------------------------ */

interface CardProps {
  catalog: KpiCatalogItem;
  entry: DraftEntry;
  stored: ProjectKpi | undefined;
  expanded: boolean;
  invalid: boolean;
  onToggleExpand: () => void;
  onChange: (patch: Partial<DraftEntry>) => void;
}

function KpiConfigCard({
  catalog,
  entry,
  stored,
  expanded,
  invalid,
  onToggleExpand,
  onChange,
}: CardProps) {
  const computed = stored ? computeKpi(stored) : null;

  return (
    <div
      className={
        "rounded-2xl border bg-surface-2 transition-colors " +
        (invalid ? "border-glow" : "border-line")
      }
    >
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">{catalog.name}</p>
            <AutomaticBadge />
            <FrequencyPill label={describeFrequency(catalog.frequency)} />
            {invalid && (
              <span className="rounded-full bg-glow-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-glow">
                Revisar
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-ink-3">
            {catalog.description}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {computed && computed.value != null ? (
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-ink-3">
                Valor actual
              </p>
              <p className="text-sm font-bold text-ink">
                {formatValue(computed.value, catalog.unit)}
              </p>
            </div>
          ) : null}
          <span
            className={
              "text-ink-3 transition-transform " + (expanded ? "rotate-90" : "")
            }
            aria-hidden
          >
            ▸
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-line p-4">
          {/* Cómo se calcula */}
          <div className="mb-3 rounded-xl border border-line bg-surface px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-3">
              Cómo se calcula
            </p>
            <p className="mt-0.5 font-mono text-[12px] text-ink-2">
              {catalog.formula}
            </p>
            <p className="mt-1 text-[11px] text-ink-3">
              Fuente: {catalog.dataSource} · El valor se actualiza{" "}
              {describeFrequency(catalog.frequency).toLowerCase()}.
            </p>
          </div>

          {/* Valor actual calculado */}
          <div className="mb-3 flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-3">
                Valor actual
              </p>
              <p className="text-[11px] text-ink-3">
                (Calculado automáticamente)
              </p>
            </div>
            <div className="text-right">
              {computed && computed.value != null ? (
                <>
                  <p className="text-base font-bold text-ink">
                    {formatValue(computed.value, catalog.unit)}
                  </p>
                  <p className="text-[11px] text-ink-3">
                    {formatRelativeTime(computed.lastUpdated)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-ink-3">Sin datos aún</p>
              )}
            </div>
          </div>

          {/* Meta + Umbral de alerta */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberField
              label="Meta"
              hint="Objetivo esperado para el periodo."
              value={entry.target}
              unitSuffix={catalog.unit === "percent" ? "%" : undefined}
              onChange={(v) => onChange({ target: v })}
            />
            <NumberField
              label="Umbral de alerta"
              hint="Si el KPI baja de este valor, el sistema notificará al equipo."
              value={entry.alertThreshold}
              unitSuffix={catalog.unit === "percent" ? "%" : undefined}
              error={invalid}
              onChange={(v) => onChange({ alertThreshold: v })}
            />
          </div>

          {invalid && (
            <p className="mt-2 text-[11px] font-medium text-glow">
              La Meta debe ser mayor que el Umbral de alerta.
            </p>
          )}

          {/* Tendencia automática */}
          <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-3">
                Tendencia
              </p>
              <p className="text-[11px] text-ink-3">
                Calculada automáticamente desde el histórico.
              </p>
            </div>
            <TrendBadge computed={computed} />
          </div>
        </div>
      )}
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  unitSuffix,
  error,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  unitSuffix?: string;
  error?: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-semibold text-ink-2">{label}</span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          placeholder="—"
          onChange={(ev) => onChange(ev.target.value)}
          className={
            "w-full rounded-lg border bg-surface px-2 py-1.5 text-right text-sm text-ink outline-none focus:border-accent " +
            (error ? "border-glow" : "border-line-2")
          }
        />
        {unitSuffix && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-ink-3">
            {unitSuffix}
          </span>
        )}
      </div>
      {hint && <span className="text-[11px] text-ink-3">{hint}</span>}
    </label>
  );
}

function AutomaticBadge() {
  return (
    <span
      title="El valor se calcula automáticamente desde los datos del proyecto."
      className="rounded-full bg-sage-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sage"
    >
      Automático
    </span>
  );
}

function FrequencyPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-line-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-3">
      {label}
    </span>
  );
}

function TrendBadge({
  computed,
}: {
  computed: ReturnType<typeof computeKpi> | null;
}) {
  if (!computed || computed.trend === "unknown") {
    return <span className="text-[12px] text-ink-3">Sin historia todavía</span>;
  }
  const arrow = trendArrow(computed.trend);
  const label = trendLabel(computed.trend);
  const color =
    computed.trend === "up"
      ? "var(--color-sage)"
      : computed.trend === "down"
      ? "var(--color-glow)"
      : "var(--color-ink-2)";
  return (
    <div className="flex items-center gap-2 text-right">
      <div>
        <p className="text-sm font-bold" style={{ color }}>
          {arrow} {label}
        </p>
        {computed.trendDelta != null && (
          <p className="text-[11px] text-ink-3">
            {computed.trendDelta > 0 ? "+" : ""}
            {Math.round(computed.trendDelta * 10) / 10} pts vs. anterior
          </p>
        )}
      </div>
      <span aria-hidden style={{ color: statusColor(computed.status) }}>
        {statusEmoji(computed.status)}
      </span>
      <span className="sr-only">{statusLabel(computed.status)}</span>
    </div>
  );
}
