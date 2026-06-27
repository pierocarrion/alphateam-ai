import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import {
  user as userTable,
  userProfile,
  workspace as workspaceTable,
  membership,
  goal,
  milestone as milestoneTable,
} from "@drizzle/schema";
import { eq, asc } from "drizzle-orm";
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

  const user = await db
    .select({
      id: userTable.id,
      tone: userProfile.tone,
    })
    .from(userTable)
    .leftJoin(userProfile, eq(userProfile.userId, userTable.id))
    .where(eq(userTable.email, session.user.email))
    .then((r) => r[0] ?? null);
  if (!user) redirect("/login");

  const { active } = await getActiveWorkspace(user.id);
  if (!active) redirect("/setup");

  const workspace = await db.query.workspace.findFirst({
    where: eq(workspaceTable.id, active.workspaceId),
  });
  if (!workspace) redirect("/setup");

  const [membershipRows, goals] = await Promise.all([
    db
      .select({ userId: membership.userId, userName: userTable.name })
      .from(membership)
      .leftJoin(userTable, eq(userTable.id, membership.userId))
      .where(eq(membership.workspaceId, workspace.id)),
    db.query.goal.findMany({
      where: eq(goal.workspaceId, workspace.id),
      limit: 1,
    }),
  ]);

  const goalRow = goals[0];
  const milestoneRow = goalRow
    ? (
        await db.query.milestone.findMany({
          where: eq(milestoneTable.goalId, goalRow.id),
          orderBy: asc(milestoneTable.dueDate),
          limit: 1,
        })
      )[0] ?? null
    : null;

  const warm = user.tone === "balanced" ? false : true;
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

  const contributorsAll = membershipRows
    .map((m) => personIdFromName(m.userName ?? "") as PersonId)
    .filter((p) => p.length > 0);
  const milestone = milestoneRow
    ? {
        title: milestoneRow.title,
        due: milestoneRow.dueDate
          ? formatDaysUntil(milestoneRow.dueDate, locale)
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
