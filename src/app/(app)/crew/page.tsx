import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { computeLoadBalance, computeWorkspaceMood } from "@/server/lib/metrics";
import { personIdFromName } from "@/shared/lib/person";
import { CrewClient } from "./CrewClient";
import type { PersonId } from "@/shared/ui";
import { getLocale } from "@/i18n/server";
import { t, type Locale } from "@/i18n/messages";

export default async function CrewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { profile: true },
  });
  if (!user) redirect("/login");

  const { active } = await getActiveWorkspace(user.id);
  if (!active) redirect("/setup");

  const workspace = await prisma.workspace.findUnique({
    where: { id: active.workspaceId },
    include: {
      memberships: { include: { user: { select: { id: true, name: true } } } },
      goals: {
        include: { milestones: { orderBy: { dueDate: "asc" } } },
        take: 1,
      },
    },
  });
  if (!workspace) redirect("/setup");

  const warm = user.profile?.tone === "balanced" ? false : true;
  const locale = await getLocale();

  const mood = await computeWorkspaceMood(workspace.id);
  const load = await computeLoadBalance(workspace.id);

  const loadGuardian = load.heavy
    ? {
        who: personIdFromName(load.heavy.name) as PersonId,
        userId: load.heavy.userId,
        title: t(locale, "crew.loadTitle", {
          name: load.heavy.name,
          count: load.heavy.openCount,
        }),
        note: t(locale, "crew.loadNote"),
      }
    : null;

  const goal = workspace.goals[0];
  const contributorsAll = workspace.memberships
    .map((m) => personIdFromName(m.user.name ?? "") as PersonId)
    .filter((p) => p.length > 0);
  const milestone = goal?.milestones[0]
    ? {
        title: goal.milestones[0].title,
        due: goal.milestones[0].dueDate
          ? formatDaysUntil(goal.milestones[0].dueDate, locale)
          : t(locale, "crew.soon"),
        contributors: contributorsAll.length
          ? contributorsAll.slice(0, 4)
          : (["maya", "sofia", "theo"] as PersonId[]),
      }
    : null;

  const others = load.counts.filter((c) => c.userId !== user.id);
  const lightest = others.length
    ? others.reduce((min, c) => (c.openCount < min.openCount ? c : min))
    : load.counts[0];
  const pair = {
    who: personIdFromName(lightest?.name ?? "sofia") as PersonId,
    userId: lightest?.userId ?? "",
    available: (lightest?.openCount ?? 0) <= 1,
  };

  return (
    <CrewClient
      warm={warm}
      mood={mood}
      loadGuardian={loadGuardian}
      milestone={milestone}
      pair={pair}
    />
  );
}

function formatDaysUntil(dueDate: Date, locale: Locale): string {
  const days = Math.max(
    1,
    Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
  return t(locale, "crew.daysUntil", { count: days });
}
