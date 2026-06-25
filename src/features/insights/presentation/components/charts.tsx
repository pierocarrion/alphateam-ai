"use client";

import { cn } from "@/shared/lib/cn";
import { t } from "@/i18n/messages";
import { useLocale } from "@/i18n/useLocale";

interface ScoreVisual {
  score: number;
  status: "healthy" | "moderate" | "critical" | "low" | "high";
  invert?: boolean;
}

export function statusColor(
  status: ScoreVisual["status"],
  invert = false
): string {
  const healthy = invert ? "#E0625A" : "#5FB87A";
  const moderate = "#E6B45A";
  const critical = invert ? "#5FB87A" : "#E0625A";
  switch (status) {
    case "healthy":
    case "low":
      return healthy;
    case "moderate":
      return moderate;
    case "critical":
    case "high":
      return critical;
    default:
      return moderate;
  }
}

interface GaugeProps extends ScoreVisual {
  size?: number;
  label?: string;
  sublabel?: string;
}

export function Gauge({
  score,
  status,
  invert = false,
  size = 160,
  label,
  sublabel,
}: GaugeProps) {
  const pct = Math.max(0, Math.min(100, score));
  const radius = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  const color = statusColor(status, invert);
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size * 0.62 }}
    >
      <svg
        width={size}
        height={size * 0.62}
        viewBox={`0 0 ${size} ${size * 0.62}`}
      >
        <path
          d={describeArc(cx, cy, radius, -90, 90)}
          fill="none"
          stroke="var(--color-line-2)"
          strokeWidth={10}
          strokeLinecap="round"
        />
        <path
          d={describeArc(cx, cy, radius, -90, 90)}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
        <span
          className="font-display text-2xl font-bold tracking-tight"
          style={{ color: "var(--color-ink)" }}
        >
          {Math.round(pct)}
        </span>
        {label && (
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">
            {label}
          </span>
        )}
        {sublabel && (
          <span className="text-[10px] text-ink-3">{sublabel}</span>
        )}
      </div>
    </div>
  );
}

interface RadialMeterProps extends ScoreVisual {
  size?: number;
  label?: string;
}

export function RadialMeter({
  score,
  status,
  invert = false,
  size = 140,
  label,
}: RadialMeterProps) {
  const pct = Math.max(0, Math.min(100, score));
  const radius = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  const color = statusColor(status, invert);
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--color-line-2)"
          strokeWidth={9}
        />
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-bold text-ink">
          {Math.round(pct)}
        </span>
        {label && (
          <span className="text-[10px] uppercase tracking-[0.14em] text-ink-3">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

interface LineTrendProps {
  points: { date: string; score: number }[];
  height?: number;
  color?: string;
  invert?: boolean;
  ariaLabel?: string;
}

export function LineTrend({
  points,
  height = 56,
  color = "var(--color-accent)",
  invert = false,
  ariaLabel,
}: LineTrendProps) {
  const [locale] = useLocale();
  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-card border border-dashed border-line-2 text-xs text-ink-3"
        style={{ height }}
      >
        {t(locale, "insights.charts.noData")}
      </div>
    );
  }
  const width = 240;
  const pad = 6;
  const values = points.map((p) => p.score);
  const max = Math.max(100, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  const stepX = (width - pad * 2) / Math.max(1, points.length - 1);

  const toY = (v: number) => {
    const normalized = (v - min) / range;
    const inverted = invert ? normalized : 1 - normalized;
    return pad + inverted * (height - pad * 2);
  };

  const path = points
    .map((p, i) => {
      const x = pad + i * stepX;
      const y = toY(p.score);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${path} L${pad + (points.length - 1) * stepX},${height - pad} L${pad},${
          height - pad
        } Z`
      : "";

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {areaPath && <path d={areaPath} fill="url(#trend-fill)" />}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={pad + i * stepX}
          cy={toY(p.score)}
          r={2}
          fill={color}
        />
      ))}
    </svg>
  );
}

interface BarListProps {
  items: {
    label: string;
    value: number;
    max: number;
    color?: string;
    detail?: string;
  }[];
}

export function BarList({ items }: BarListProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => {
        const pct = item.max > 0 ? (item.value / item.max) * 100 : 0;
        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="truncate text-ink-2">{item.label}</span>
              <span className="text-ink-3">
                {item.detail ?? `${Math.round(pct)}%`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-line-2/40">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, pct)}%`,
                  background:
                    item.color ??
                    "linear-gradient(to right, var(--color-accent), var(--color-glow))",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface HeatmapProps {
  rows: { label: string; cells: { value: number; label: string }[] }[];
  max: number;
}

export function Heatmap({ rows, max }: HeatmapProps) {
  return (
    <div className="flex flex-col gap-1">
      {rows.map((row, ri) => (
        <div key={ri} className="flex items-center gap-2">
          <span className="w-24 shrink-0 truncate text-xs text-ink-3">
            {row.label}
          </span>
          <div className="flex flex-1 gap-1">
            {row.cells.map((cell, ci) => {
              const intensity = max > 0 ? cell.value / max : 0;
              const bg =
                intensity >= 1.2
                  ? "rgba(224,98,90,0.85)"
                  : intensity >= 0.85
                  ? "rgba(230,180,90,0.8)"
                  : "rgba(95,184,122,0.7)";
              return (
                <div
                  key={ci}
                  title={`${cell.label}: ${Math.round(cell.value)}%`}
                  className="h-7 flex-1 rounded-md"
                  style={{ background: intensity > 0 ? bg : "var(--color-line-2)" }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

interface StackedBarsProps {
  points: {
    date: string;
    a: number;
    b: number;
  }[];
  labels: [string, string];
  height?: number;
}

export function StackedBars({ points, labels, height = 80 }: StackedBarsProps) {
  const max = Math.max(
    1,
    ...points.map((p) => p.a + p.b)
  );
  return (
    <div>
      <div className="mb-2 flex items-center gap-3 text-[10px] text-ink-3">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" />
          {labels[0]}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--color-glow)" }} />
          {labels[1]}
        </span>
      </div>
      <div
        className={cn("flex items-end gap-1.5")}
        style={{ height }}
      >
        {points.map((p, i) => {
          const total = ((p.a + p.b) / max) * 100;
          const aRatio = p.a + p.b > 0 ? p.a / (p.a + p.b) : 0;
          return (
            <div
              key={i}
              className="flex h-full flex-1 flex-col justify-end"
              title={`${p.date}`}
            >
              <div
                className="w-full overflow-hidden rounded-md"
                style={{ height: `${total}%` }}
              >
                <div
                  className="w-full"
                  style={{
                    height: `${(1 - aRatio) * 100}%`,
                    background: "var(--color-glow)",
                  }}
                />
                <div
                  className="w-full"
                  style={{
                    height: `${aRatio * 100}%`,
                    background: "var(--color-accent)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angle = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}
