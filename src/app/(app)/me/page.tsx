import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { sumRecoveredMinutesThisWeek } from "@/server/lib/metrics";
import { Mira, HubRow, Button } from "@/shared/ui";

export default async function MePage() {
  const session = await getServerSession(authOptions);
  const user = await prisma.user.findUnique({
    where: { email: session?.user?.email ?? "" },
    include: { profile: true },
  });

  const name = user?.name?.split(" ")[0] ?? "you";
  const warm = user?.profile?.tone === "balanced" ? false : true;

  const minutes = user ? await sumRecoveredMinutesThisWeek(user.id) : 0;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  const recoveredLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <div className="flex h-full flex-col">
      <div className="h-[58px] flex-none lg:hidden" />
      <div className="flex-1 overflow-y-auto scrollbar-hide px-[18px] pb-4 lg:max-w-3xl lg:mx-auto">
        <div className="stagger flex flex-col gap-3.5">
          {/* Recovered highlight */}
          <div
            className="relative overflow-hidden rounded-[24px] border border-line-2 p-5"
            style={{
              background: "linear-gradient(160deg, var(--color-sage-soft), transparent)",
            }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
              This week, together
            </p>
            <div className="mt-2 font-display text-[34px] text-ink">{recoveredLabel}</div>
            <p className="mt-1 text-ink-2">
              recovered from circling — yours to spend however you like.
            </p>
          </div>

          <HubRow
            icon="spark"
            tint="var(--color-accent)"
            title="Insights"
            sub="Your progress, told kindly"
            href="/insights"
          />
          <HubRow
            icon="doc"
            tint="var(--color-glow)"
            title="One thing at a time"
            sub="Hide the pile, focus the day"
            href="/day"
          />
          <HubRow
            icon="moon"
            tint="#9FB8E0"
            title="Wind down"
            sub="A calm close to the night"
            href="/night"
          />
          <HubRow
            icon="bell"
            tint="var(--color-sage)"
            title="Settings"
            sub="Rhythm, apps, gentle nudges"
            href="/settings"
          />

          <Button
            variant="quiet"
            className="mt-0.5"
            href={warm ? "/onboarding?replay=1" : "/settings"}
          >
            Replay the welcome
          </Button>
        </div>
      </div>
    </div>
  );
}
