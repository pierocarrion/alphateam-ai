import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { computeLoadBalance, computeWorkspaceMood } from "@/server/lib/metrics";
import { personIdFromName } from "@/shared/lib/person";
import { CrewClient } from "./CrewClient";
import type { PersonId } from "@/shared/ui";

export default async function CrewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      profile: true,
      memberships: {
        include: {
          workspace: {
            include: {
              memberships: { include: { user: { select: { id: true, name: true } } } },
              goals: {
                include: { milestones: { orderBy: { dueDate: "asc" } } },
                take: 1,
              },
            },
          },
        },
      },
    },
  });
  if (!user) redirect("/login");

  const membership = user.memberships[0];
  if (!membership) redirect("/setup");

  const workspace = membership.workspace;

  const warm = user.profile?.tone === "balanced" ? false : true;

  const mood = await computeWorkspaceMood(workspace.id);
  const load = await computeLoadBalance(workspace.id);

  const loadGuardian = load.heavy
    ? {
        who: personIdFromName(load.heavy.name) as PersonId,
        userId: load.heavy.userId,
        title: `${load.heavy.name}’s been catching most of the work — ${load.heavy.openCount} open task${load.heavy.openCount === 1 ? "" : "s"}.`,
        note:
          "They procrastinate least, so the load drifts to them. Want to even it out?",
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
          ? formatDaysUntil(goal.milestones[0].dueDate)
          : "Soon",
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

function formatDaysUntil(dueDate: Date): string {
  const days = Math.max(
    1,
    Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
  return `In about ${days} days`;
}
