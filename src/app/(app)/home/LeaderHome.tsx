import Link from "next/link";
import { Icon } from "@/shared/ui";
import type { LeaderBriefingResult } from "@/server/lib/leaderBriefing";
import type { Locale } from "@/i18n/messages";
import { t } from "@/i18n/messages";

interface LeaderHomeProps {
  leaderName: string;
  workspaceName: string;
  briefing: LeaderBriefingResult;
  locale: Locale;
}

const RISK_COLORS: Record<string, string> = {
  low: "var(--color-sage)",
  medium: "var(--color-accent)",
  high: "var(--color-glow)",
  critical: "#e87878",
};

function healthFromRisk(
  locale: Locale,
  score: number
): { value: number; label: string } {
  const value = Math.max(0, 100 - score);
  if (value >= 80) return { value, label: t(locale, "leader.health.good") };
  if (value >= 60) return { value, label: t(locale, "leader.health.fair") };
  if (value >= 40) return { value, label: t(locale, "leader.health.atRisk") };
  return { value, label: t(locale, "leader.health.critical") };
}

const SEV_COLOR: Record<string, string> = {
  low: "var(--color-sage)",
  medium: "var(--color-accent)",
  high: "var(--color-glow)",
};

export function LeaderHome({
  leaderName,
  workspaceName,
  briefing,
  locale,
}: LeaderHomeProps) {
  const tr = (k: string, v?: Record<string, string | number>) =>
    t(locale, k, v);
  const health = healthFromRisk(locale, briefing.risk.riskScore);
  const riskColor = RISK_COLORS[briefing.risk.level] ?? RISK_COLORS.low;

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="flex-none border-b border-line px-5 py-4 lg:px-8 lg:py-5">
        <div className="flex items-center gap-2.5">
          <Icon name="shield" size={22} color="var(--color-accent)" />
          <h1 className="font-display text-2xl text-ink">
            {tr("leader.greeting", { name: leaderName })}
          </h1>
        </div>
        <p className="mt-1.5 text-sm text-ink-2">
          {tr("leader.sub", { workspace: workspaceName })}
        </p>
      </div>

      <div className="flex-1 px-5 py-5 lg:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-5">
          {/* Top row: Briefing + Health */}
          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            {/* Morning Briefing */}
            <section className="relative overflow-hidden rounded-[26px] border border-line-2 bg-gradient-to-br from-surface-2 to-surface p-6">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent-soft" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
                    {tr("leader.briefing")}
                  </p>
                  <span className="text-[10.5px] text-ink-3">
                    {briefing.usedAi
                      ? tr("leader.aiDistilled")
                      : tr("leader.heuristic")}
                  </span>
                </div>
                <h2 className="mt-3 font-display text-[22px] leading-tight text-ink text-wrap-pretty">
                  {briefing.headline}
                </h2>
                <ul className="mt-4 space-y-2">
                  {briefing.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2.5 text-[14.5px] text-ink-2">
                      <span
                        className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full"
                        style={{ background: "var(--color-accent)" }}
                      />
                      <span className="text-wrap-pretty">{b}</span>
                    </li>
                  ))}
                </ul>
                {briefing.needsAttention.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-line bg-surface/60 p-3.5">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-3">
                      {tr("leader.needsYou")}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {briefing.needsAttention.map((n, i) => (
                        <li
                          key={i}
                          className="flex gap-2 text-[13.5px] text-ink"
                        >
                          <Icon
                            name="bell"
                            size={14}
                            color="var(--color-glow)"
                          />
                          <span>{n}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>

            {/* Project Health */}
            <section className="flex flex-col rounded-[26px] border border-line bg-surface p-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                {tr("leader.health")}
              </p>
              <div className="mt-3 flex items-end gap-3">
                <span className="font-display text-[56px] leading-none text-ink">
                  {health.value}
                </span>
                <span
                  className="mb-1.5 text-sm font-bold"
                  style={{ color: riskColor }}
                >
                  {health.label}
                </span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${health.value}%`,
                    background: `linear-gradient(to right, var(--color-sage), var(--color-accent))`,
                  }}
                />
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-3">{tr("leader.deliveryRisk")}</span>
                  <span
                    className="font-bold"
                    style={{ color: riskColor }}
                  >
                    {tr(`leader.risk.${briefing.risk.level}`)} ·{" "}
                    {briefing.risk.riskScore}
                  </span>
                </div>
                {briefing.risk.reasons.slice(0, 3).map((r, i) => (
                  <p key={i} className="text-[12.5px] text-ink-3 text-wrap-pretty">
                    · {r}
                  </p>
                ))}
              </div>
            </section>
          </div>

          {/* KPI grid */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KpiTile
              label={tr("leader.kpi.openTasks")}
              value={briefing.kpi.openTasks}
              icon="doc"
              tint="var(--color-accent)"
            />
            <KpiTile
              label={tr("leader.kpi.overdue")}
              value={briefing.kpi.overdueTasks}
              icon="clock"
              tint={briefing.kpi.overdueTasks > 0 ? "var(--color-glow)" : "var(--color-sage)"}
            />
            <KpiTile
              label={tr("leader.kpi.doneWeek")}
              value={briefing.kpi.completedThisWeek}
              icon="check"
              tint="var(--color-sage)"
            />
            <KpiTile
              label={tr("leader.kpi.blockers")}
              value={briefing.kpi.activeBlockers}
              icon="bell"
              tint={briefing.kpi.activeBlockers > 0 ? "var(--color-glow)" : "var(--color-sage)"}
            />
            <KpiTile
              label={tr("leader.kpi.decisions")}
              value={briefing.kpi.pendingDecisions}
              icon="spark"
              tint="var(--color-accent)"
            />
            <KpiTile
              label={tr("leader.kpi.overloaded")}
              value={briefing.kpi.overloadedMembers}
              icon="crew"
              tint={briefing.kpi.overloadedMembers > 0 ? "var(--color-glow)" : "var(--color-sage)"}
            />
          </section>

          {/* Eisenhower + Blockers */}
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            {/* Eisenhower matrix */}
            <section className="rounded-[26px] border border-line bg-surface p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                  {tr("leader.eisenhower")}
                </p>
                <Link
                  href="/backstage"
                  className="text-[12px] font-semibold text-accent hover:underline"
                >
                  {tr("leader.openBackstage")}
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <QuadrantTile
                  title={tr("leader.q1")}
                  sub={tr("leader.q1sub")}
                  count={briefing.eisenhower.q1}
                  tint="var(--color-glow)"
                />
                <QuadrantTile
                  title={tr("leader.q2")}
                  sub={tr("leader.q2sub")}
                  count={briefing.eisenhower.q2}
                  tint="var(--color-accent)"
                />
                <QuadrantTile
                  title={tr("leader.q3")}
                  sub={tr("leader.q3sub")}
                  count={briefing.eisenhower.q3}
                  tint="var(--color-sage)"
                />
                <QuadrantTile
                  title={tr("leader.q4")}
                  sub={tr("leader.q4sub")}
                  count={briefing.eisenhower.q4}
                  tint="var(--color-ink-3)"
                />
              </div>
              {briefing.eisenhower.unsorted > 0 && (
                <p className="mt-3 text-[12px] text-ink-3">
                  {tr("leader.unsorted", { count: briefing.eisenhower.unsorted })}
                </p>
              )}
            </section>

            {/* Active blockers */}
            <section className="rounded-[26px] border border-line bg-surface p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                {tr("leader.blockers")}
              </p>
              {briefing.blockers.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-line-2 p-5 text-center">
                  <Icon name="check" size={22} color="var(--color-sage)" />
                  <p className="mt-2 text-[13.5px] text-ink-2">
                    {tr("leader.noBlockers")}
                  </p>
                </div>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {briefing.blockers.slice(0, 5).map((b) => (
                    <li
                      key={b.id}
                      className="rounded-2xl border border-line bg-surface-2 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 flex-none rounded-full"
                          style={{
                            background: SEV_COLOR[b.severity] ?? SEV_COLOR.low,
                          }}
                        />
                        <span className="text-[12px] font-bold text-ink-3">
                          {b.author}
                        </span>
                        <span className="ml-auto text-[10.5px] text-ink-3">
                          {b.severity}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[13.5px] text-ink text-wrap-pretty">
                        {b.text}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Decisions + Mentions */}
          <div className="grid gap-5 lg:grid-cols-2">
            <ListCard
              title={tr("leader.decisions")}
              empty={tr("leader.decisionsEmpty")}
              items={briefing.decisions.map((d) => ({
                id: d.id,
                author: d.author,
                text: d.text,
              }))}
              tint="var(--color-accent)"
            />
            <ListCard
              title={tr("leader.mentions")}
              empty={tr("leader.mentionsEmpty")}
              items={briefing.mentions.map((m) => ({
                id: m.id,
                author: m.author,
                text: m.text,
                tag: m.implicit ? "implicit" : undefined,
              }))}
              tint="var(--color-glow)"
            />
          </div>

          {/* Doors */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DoorCard
              icon="chat"
              tint="var(--color-glow)"
              title={tr("leader.doorAsk")}
              sub={tr("leader.doorAskSub")}
              href="/chat"
            />
            <DoorCard
              icon="crew"
              tint="var(--color-accent)"
              title={tr("leader.doorCrew")}
              sub={tr("leader.doorCrewSub")}
              href="/crew"
            />
            <DoorCard
              icon="shield"
              tint="var(--color-sage)"
              title={tr("leader.doorBackstage")}
              sub={tr("leader.doorBackstageSub")}
              href="/backstage"
            />
            <DoorCard
              icon="spark"
              tint="var(--color-accent)"
              title={tr("leader.doorInsights")}
              sub={tr("leader.doorInsightsSub")}
              href="/insights"
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: number;
  icon: React.ComponentProps<typeof Icon>["name"];
  tint: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5">
      <div className="flex items-center justify-between">
        <Icon name={icon} size={16} color={tint} />
      </div>
      <div className="mt-2 font-display text-[26px] leading-none text-ink">
        {value}
      </div>
      <div className="mt-1 text-[11.5px] text-ink-3">{label}</div>
    </div>
  );
}

function QuadrantTile({
  title,
  sub,
  count,
  tint,
}: {
  title: string;
  sub: string;
  count: number;
  tint: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-bold text-ink">{title}</span>
        <span
          className="font-display text-[20px] leading-none"
          style={{ color: tint }}
        >
          {count}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-ink-3">{sub}</p>
    </div>
  );
}

function ListCard({
  title,
  items,
  empty,
  tint,
}: {
  title: string;
  items: Array<{ id: string; author: string; text: string; tag?: string }>;
  empty: string;
  tint: string;
}) {
  return (
    <section className="rounded-[26px] border border-line bg-surface p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
        {title}
      </p>
      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line-2 p-5 text-center">
          <p className="text-[13.5px] text-ink-2">{empty}</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.slice(0, 6).map((it) => (
            <li key={it.id} className="rounded-2xl border border-line bg-surface-2 p-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 flex-none rounded-full"
                  style={{ background: tint }}
                />
                <span className="text-[12px] font-bold text-ink-3">{it.author}</span>
                {it.tag && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-accent">
                    {it.tag}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[13.5px] text-ink text-wrap-pretty">
                {it.text}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DoorCard({
  icon,
  tint,
  title,
  sub,
  href,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  tint: string;
  title: string;
  sub: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-[20px] border border-line bg-surface p-4 transition-colors hover:bg-surface-2"
    >
      <div
        className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[13px]"
        style={{ background: "var(--color-surface-2)" }}
      >
        <Icon name={icon} size={21} color={tint} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold text-ink">{title}</div>
        <div className="text-xs text-ink-3">{sub}</div>
      </div>
      <Icon name="arrow" size={18} color="var(--color-ink-3)" />
    </Link>
  );
}
