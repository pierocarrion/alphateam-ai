import { db } from "@/server/lib/db";
import { task, ritualSession, teamMetric, membership, user } from "@drizzle/schema";
import { eq, inArray, desc, and } from "drizzle-orm";
import { HealthSignal, WorkspaceHealthReport } from "./aiTypes";

const DEADLINE_DAYS = 2;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function runWorkspaceHealthCheck(workspaceId: string): Promise<WorkspaceHealthReport> {
  const now = new Date();

  const memberUserIds = db
    .select({ id: membership.userId })
    .from(membership)
    .where(eq(membership.workspaceId, workspaceId));

  const [openTaskRows, ritualRows, metrics, membershipRows] = await Promise.all([
    db
      .select({
        userId: task.userId,
        deadline: task.deadline,
        userName: user.name,
      })
      .from(task)
      .leftJoin(user, eq(user.id, task.userId))
      .where(and(eq(task.status, "open"), inArray(task.userId, memberUserIds))),
    db
      .select({ createdAt: ritualSession.createdAt })
      .from(ritualSession)
      .where(inArray(ritualSession.userId, memberUserIds)),
    db
      .select({
        type: teamMetric.type,
        value: teamMetric.value,
        metadata: teamMetric.metadata,
      })
      .from(teamMetric)
      .where(eq(teamMetric.workspaceId, workspaceId))
      .orderBy(desc(teamMetric.date)),
    db
      .select({ userId: membership.userId, userName: user.name })
      .from(membership)
      .leftJoin(user, eq(user.id, membership.userId))
      .where(eq(membership.workspaceId, workspaceId)),
  ]);

  const openTasks = openTaskRows.map((r) => ({
    userId: r.userId,
    deadline: r.deadline,
    user: { name: r.userName ?? null },
  }));
  const rituals = ritualRows;
  const memberships = membershipRows.map((r) => ({
    userId: r.userId,
    user: { name: r.userName ?? null },
  }));

  const signals: HealthSignal[] = [];

  // Load imbalance: count open tasks per member.
  const counts = new Map<string, number>();
  for (const t of openTasks) {
    counts.set(t.userId, (counts.get(t.userId) ?? 0) + 1);
  }
  const countsArr = Array.from(counts.values());
  const maxCount = countsArr.length ? Math.max(...countsArr) : 0;
  const minCount = countsArr.length ? Math.min(...countsArr) : 0;
  if (maxCount - minCount >= 2 && maxCount >= 3) {
    const heavyUser = Array.from(counts.entries()).find(([, c]) => c === maxCount);
    const us = memberships.find((m) => m.userId === heavyUser?.[0])?.user;
    signals.push({
      type: "load_imbalance",
      severity: "medium",
      summary: `${us?.name ?? "Someone"} is carrying ${maxCount} open tasks. Consider sharing the load.`,
      userId: heavyUser?.[0],
      suggestedAction: "pair_match_or_rebalance",
    });
  }

  // Deadline risk.
  const atRisk = openTasks.filter(
    (t) => t.deadline && t.deadline <= addDays(now, DEADLINE_DAYS) && t.deadline >= now
  );
  if (atRisk.length > 0) {
    signals.push({
      type: "deadline_risk",
      severity: atRisk.length > 2 ? "high" : "medium",
      summary: `${atRisk.length} task${atRisk.length === 1 ? "" : "s"} due within ${DEADLINE_DAYS} days.`,
      suggestedAction: "prioritize_and_microstep",
    });
  }

  // Mood dip.
  const moodMetric = metrics.find((m) => m.type === "mood");
  if (moodMetric && moodMetric.value < 0.45) {
    signals.push({
      type: "mood_dip",
      severity: "medium",
      summary: `Team mood is low (${(moodMetric.metadata as string) ?? "check in"}). A tiny group ritual might help.`,
      suggestedAction: "group_check_in",
    });
  }

  // Recovery win.
  const recoveredMetric = metrics.find((m) => m.type === "recovered_minutes");
  const recoveredMinutes = Math.round(recoveredMetric?.value ?? 0);
  if (recoveredMinutes > 60) {
    signals.push({
      type: "recovery_win",
      severity: "low",
      summary: `Team recovered ${Math.floor(recoveredMinutes / 60)}h ${recoveredMinutes % 60}m from circling this week.`,
    });
  }

  // Procrastination spike: many open tasks with few rituals.
  const recentRituals = rituals.filter((r) => r.createdAt > addDays(now, -7));
  if (openTasks.length >= 4 && recentRituals.length < openTasks.length / 2) {
    signals.push({
      type: "procrastination_spike",
      severity: "medium",
      summary: "Several open tasks and few starts this week. Hiding the pile might help.",
      suggestedAction: "day_mode_focus",
    });
  }

  return {
    workspaceId,
    generatedAt: now,
    signals,
    teamMood: {
      value: moodMetric?.value ?? 0.62,
      label: (moodMetric?.metadata as string) ?? "Steady",
    },
    recoveredMinutes,
  };
}
