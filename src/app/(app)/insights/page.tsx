import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { recoveredMinutesByDay } from "@/server/lib/metrics";
import { Alpha, TopBar } from "@/shared/ui";

const FALLBACK_WEEK = [
  { d: "M", v: 0 },
  { d: "T", v: 0 },
  { d: "W", v: 0 },
  { d: "T", v: 0 },
  { d: "F", v: 0 },
  { d: "S", v: 0, calm: true },
  { d: "S", v: 0 },
];

export default async function InsightsPage() {
  const session = await getServerSession(authOptions);
  const user = await prisma.user.findUnique({
    where: { email: session?.user?.email ?? "" },
    include: { profile: true },
  });

  const week = user
    ? await recoveredMinutesByDay(user.id, 7)
    : [];

  const WEEK =
    week.length === 7
      ? week.map((b) => {
          const dow = b.date.getDay();
          const isWeekend = dow === 0 || dow === 6;
          return {
            d: b.label,
            v: Math.round(b.minutes),
            calm: isWeekend && b.minutes === 0,
          };
        })
      : FALLBACK_WEEK;

  const starts = user
    ? await prisma.userMetric.count({
        where: { userId: user.id, type: "rituals_completed" },
      })
    : 0;

  const dotCount = Math.max(1, starts);
  const max = Math.max(45, ...WEEK.map((w) => w.v));

  return (
    <div className="flex h-full flex-col">
      <TopBar className="lg:hidden" title="Insights" kicker="Told kindly" />
      <div className="flex-1 overflow-y-auto scrollbar-hide px-[18px] pb-4 lg:max-w-3xl lg:mx-auto">
        <div className="stagger flex flex-col gap-4">
          <p className="lead text-wrap-pretty">
            Every bar is time you took back. Quiet days aren’t failures — they’re rest.
          </p>

          {/* Recovered-time bars */}
          <div className="rounded-card border border-line bg-surface p-5">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                Time recovered
              </p>
              <span className="text-xs text-ink-3">minutes / day</span>
            </div>
            <div className="mt-4 flex h-[130px] items-end gap-2.5">
              {WEEK.map((w, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <div
                    className="flex w-full items-center justify-center rounded-lg"
                    style={{
                      height: `${Math.max((w.v / max) * 100, w.calm ? 0 : 4)}%`,
                      minHeight: w.calm ? 22 : 0,
                      background: w.calm
                        ? "transparent"
                        : "linear-gradient(to top, var(--color-accent), var(--color-glow))",
                      border: w.calm ? "1.5px dashed var(--color-line-2)" : "none",
                    }}
                  >
                    {w.calm && <span className="text-[10px] text-ink-3">rest</span>}
                  </div>
                  <span className="text-xs text-ink-3">{w.d}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Gentle momentum */}
          <div className="rounded-card border border-line bg-surface p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
              Gentle starts
            </p>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {Array.from({ length: dotCount }).map((_, i) => (
                <div
                  key={i}
                  className="h-[22px] w-[22px] rounded-full opacity-90"
                  style={{
                    background: "radial-gradient(circle at 35% 30%, #f4d6a8, var(--color-accent))",
                    boxShadow: "0 0 12px -2px var(--color-accent-soft)",
                  }}
                />
              ))}
            </div>
            <p className="mt-3.5 text-ink-2">
              {starts} time{starts === 1 ? "" : "s"} you crossed the hardest part — the start. That’s the whole game.
            </p>
          </div>

          <div className="flex items-center gap-3 px-1">
            <Alpha size={30} mood="happy" />
            <p className="flex-1 text-xs text-ink-3 text-wrap-pretty">
              No streaks to break here. You can always begin again — that’s the point.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
