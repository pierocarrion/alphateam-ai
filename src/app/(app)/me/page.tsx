import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { sumRecoveredMinutesThisWeek } from "@/server/lib/metrics";
import { HubRow, Button } from "@/shared/ui";
import { WorkspaceSwitcher } from "@/features/navigation/components/WorkspaceSwitcher";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/messages";

export default async function MePage() {
  const session = await getServerSession(authOptions);
  const user = await prisma.user.findUnique({
    where: { email: session?.user?.email ?? "" },
    include: { profile: true },
  });

  const activeState = user ? await getActiveWorkspace(user.id) : null;
  const active = activeState?.active ?? null;
  const memberships = activeState?.memberships ?? [];

  const warm = user?.profile?.tone === "balanced" ? false : true;

  const minutes = user ? await sumRecoveredMinutesThisWeek(user.id) : 0;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  const recoveredLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const locale = await getLocale();
  const tr = (k: string, v?: Record<string, string | number>) =>
    t(locale, k, v);

  return (
    <div className="flex h-full flex-col">
      <div className="h-[58px] flex-none lg:hidden" />
      <div className="flex-1 overflow-y-auto scrollbar-hide px-[18px] pb-4 lg:max-w-3xl lg:mx-auto">
        <div className="stagger flex flex-col gap-3.5">
          {/* Project switcher (mobile-friendly) */}
          {active && (
            <div className="lg:hidden">
              <WorkspaceSwitcher
                workspaces={memberships.map((m) => ({
                  id: m.workspace.id,
                  name: m.workspace.name,
                  emoji: m.workspace.emoji,
                  hashtag: m.workspace.hashtag,
                }))}
                activeId={active.workspaceId}
                activeName={active.workspaceName}
                activeEmoji={active.workspaceEmoji}
                activeHashtag={active.workspaceHashtag}
              />
            </div>
          )}

          {/* Recovered highlight */}
          <div
            className="relative overflow-hidden rounded-[24px] border border-line-2 p-5"
            style={{
              background: "linear-gradient(160deg, var(--color-sage-soft), transparent)",
            }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
              {tr("me.thisWeek")}
            </p>
            <div className="mt-2 font-display text-[34px] text-ink">{recoveredLabel}</div>
            <p className="mt-1 text-ink-2">{tr("me.recovered")}</p>
          </div>

          <HubRow
            icon="spark"
            tint="var(--color-accent)"
            title={tr("me.insights")}
            sub={tr("me.insightsSub")}
            href="/insights"
          />
          <HubRow
            icon="doc"
            tint="var(--color-glow)"
            title={tr("me.focus")}
            sub={tr("me.focusSub")}
            href="/day"
          />
          <HubRow
            icon="moon"
            tint="#9FB8E0"
            title={tr("me.wind")}
            sub={tr("me.windSub")}
            href="/night"
          />
          <HubRow
            icon="bell"
            tint="var(--color-sage)"
            title={tr("me.settings")}
            sub={tr("me.settingsSub")}
            href="/settings"
          />

          <Button
            variant="quiet"
            className="mt-0.5"
            href={warm ? "/onboarding?replay=1" : "/settings"}
          >
            {tr("me.replay")}
          </Button>
        </div>
      </div>
    </div>
  );
}
