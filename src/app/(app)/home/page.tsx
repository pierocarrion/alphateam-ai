import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { buildLeaderBriefing } from "@/server/lib/leaderBriefing";
import { Alpha, Button, Icon } from "@/shared/ui";
import { LeaderHome } from "./LeaderHome";
import { getLocale } from "@/i18n/server";
import { t } from "@/i18n/messages";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const user = await prisma.user.findUnique({
    where: { email: session?.user?.email ?? "" },
    include: { profile: true },
  });

  const { active } = await getActiveWorkspace(user?.id ?? "");
  const isLeader = active?.role === "leader" || active?.role === "admin";
  const locale = await getLocale();

  if (isLeader && active && user) {
    const briefing = await buildLeaderBriefing({
      workspaceId: active.workspaceId,
      leaderId: user.id,
      leaderName: user.name ?? "Leader",
      sinceHours: 24,
    });
    return (
      <LeaderHome
        leaderName={user.name ?? "Leader"}
        workspaceName={active.workspaceName}
        briefing={briefing}
        locale={locale}
      />
    );
  }

  return (
    <MemberHome
      userId={user?.id ?? ""}
      name={user?.name ?? "you"}
      warm={user?.profile?.tone !== "balanced"}
      locale={locale}
    />
  );
}

async function MemberHome({
  userId,
  name,
  warm,
  locale,
}: {
  userId: string;
  name: string;
  warm: boolean;
  locale: import("@/i18n/messages").Locale;
}) {
  const openTasks = await prisma.task.findMany({
    where: { userId, status: "open" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const heroTask = openTasks[0];
  const otherCount = Math.max(0, openTasks.length - 1);
  const tr = (k: string, v?: Record<string, string | number>) =>
    t(locale, k, v);

  return (
    <div className="flex h-full flex-col">
      <div className="h-[58px] flex-none lg:hidden" />
      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pb-4 lg:max-w-3xl lg:mx-auto">
        {/* greeting */}
        <div className="mb-5 flex items-center gap-3 pt-1">
          <Alpha size={44} mood="happy" />
          <div>
            <div className="text-xs text-ink-3">{tr("home.greeting")}</div>
            <div className="font-display text-[22px] text-ink">{name}</div>
          </div>
        </div>

        {/* Hero card */}
        <div className="relative overflow-hidden rounded-[30px] border border-line-2 bg-gradient-to-br from-surface-2 to-surface p-6 shadow-2xl">
          <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-accent-soft" />
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
            {tr("home.rightNow")}
          </p>
          <h1 className="mt-3 font-display text-[27px] leading-tight text-ink">
            {heroTask ? heroTask.micro : tr("home.heroEmpty")}
          </h1>
          <p className="mt-3 text-ink-2">
            {heroTask
              ? tr("home.heroTaskSub", { title: heroTask.title })
              : tr("home.heroEmptySub")}
          </p>
          <div className="mt-5">
            <Button
              href={heroTask ? `/ritual/${heroTask.id}` : "/chat"}
              full
              icon="play"
            >
              {tr("home.start")}
            </Button>
          </div>
        </div>

        {/* reassurance */}
        <div className="mb-5 mt-4 flex items-center gap-3 px-1">
          <Alpha size={22} mood="calm" />
          <p className="flex-1 text-xs text-ink-3">
            {tr(
              warm ? "home.reassuranceWarm" : "home.reassuranceBalanced",
              { count: otherCount }
            )}
          </p>
        </div>

        {/* Door rows */}
        <div className="space-y-2.5">
          <DoorRow
            icon="plus"
            tint="var(--color-accent)"
            title={tr("home.doorCapture")}
            sub={tr("home.doorCaptureSub")}
            href="/capture"
          />
          <DoorRow
            icon="chat"
            tint="var(--color-glow)"
            title={tr("home.doorChat")}
            sub={tr("home.doorChatSub")}
            href="/chat"
          />
          <DoorRow
            icon="moon"
            tint="#9FB8E0"
            title={tr("home.doorWind")}
            sub={tr("home.doorWindSub")}
            href="/night"
          />
        </div>
      </div>
    </div>
  );
}

function DoorRow({
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
      className="flex w-full items-center gap-3.5 rounded-[20px] border border-line bg-surface p-4 text-left transition-colors hover:bg-surface-2"
    >
      <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[13px] bg-surface-2">
        <Icon name={icon} size={21} color={tint} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[16px] font-bold text-ink">{title}</div>
        <div className="text-xs text-ink-3">{sub}</div>
      </div>
      <Icon name="arrow" size={18} color="var(--color-ink-3)" />
    </Link>
  );
}
