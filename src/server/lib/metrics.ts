import { db } from "@/server/lib/db";
import {
  task as taskTable,
  ritualSession,
  userMetric,
  membership as membershipTable,
  teamMetric,
  user as userTable,
} from "@drizzle/schema";
import { and, eq, gte, inArray, count, asc } from "drizzle-orm";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface RitualCompletionResult {
  recoveredMinutes: number;
}

export async function recordRitualCompletion(opts: {
  userId: string;
  ritualId: string;
  taskId?: string | null;
  durationSec?: number;
  workspaceId?: string;
}): Promise<RitualCompletionResult> {
  const { userId, ritualId, taskId, durationSec, workspaceId } = opts;
  const now = new Date();

  let estimatedMinutes: number | null = null;
  if (taskId) {
    const task = await db.query.task.findFirst({
      where: and(eq(taskTable.id, taskId), eq(taskTable.userId, userId)),
      columns: { estimatedMinutes: true },
    });
    estimatedMinutes = task?.estimatedMinutes ?? null;
  }

  const recoveredMinutes =
    estimatedMinutes && estimatedMinutes > 0
      ? estimatedMinutes
      : Math.max(2, Math.round((durationSec ?? 120) / 60));

  await db
    .update(ritualSession)
    .set({ recoveredMinutes })
    .where(eq(ritualSession.id, ritualId));

  await db.insert(userMetric).values([
    { userId, date: now, type: "rituals_completed", value: 1 },
    { userId, date: now, type: "recovered_minutes", value: recoveredMinutes },
    ...(taskId
      ? [{ userId, date: now, type: "tasks_completed", value: 1 }]
      : []),
  ]);

  const resolvedWorkspaceId = workspaceId
    ? workspaceId
    : (
        await db.query.membership.findFirst({
          where: eq(membershipTable.userId, userId),
          columns: { workspaceId: true },
        })
      )?.workspaceId;
  if (resolvedWorkspaceId) {
    await db.insert(teamMetric).values({
      workspaceId: resolvedWorkspaceId,
      date: now,
      type: "recovered_minutes",
      value: recoveredMinutes,
    });
  }

  return { recoveredMinutes };
}

export async function recordTaskCompletion(userId: string): Promise<void> {
  await db.insert(userMetric).values({
    userId,
    date: new Date(),
    type: "tasks_completed",
    value: 1,
  });
}

export interface WorkspaceMood {
  value: number;
  label: string;
  note: string;
}

export async function computeWorkspaceMood(workspaceId: string): Promise<WorkspaceMood> {
  const now = new Date();
  const since = new Date(now.getTime() - WEEK_MS);

  const memberRows = await db
    .select({ userId: membershipTable.userId })
    .from(membershipTable)
    .where(eq(membershipTable.workspaceId, workspaceId));
  const memberIds = memberRows.map((r) => r.userId);

  let openTasks = 0;
  let recentRituals = 0;

  if (memberIds.length > 0) {
    const [openTaskRows, recentRitualRows] = await Promise.all([
      db
        .select({ c: count() })
        .from(taskTable)
        .where(
          and(
            eq(taskTable.status, "open"),
            inArray(taskTable.userId, memberIds)
          )
        ),
      db
        .select({ c: count() })
        .from(ritualSession)
        .where(
          and(
            gte(ritualSession.completedAt, since),
            inArray(ritualSession.userId, memberIds)
          )
        ),
    ]);
    openTasks = Number(openTaskRows[0]?.c ?? 0);
    recentRituals = Number(recentRitualRows[0]?.c ?? 0);
  }

  const denom = Math.max(recentRituals + openTasks, 1);
  const recoveryRatio = recentRituals / denom;
  const value = Math.min(0.95, Math.max(0.1, 0.3 + 0.6 * recoveryRatio));

  let label: string;
  if (value < 0.4) label = "Tense";
  else if (value < 0.55) label = "A little tense";
  else if (value < 0.7) label = "Steady";
  else if (value < 0.85) label = "Light";
  else label = "Glowing";

  let note: string;
  if (openTasks === 0 && recentRituals === 0) {
    note = "Nothing pressing right now. A quiet moment.";
  } else if (recoveryRatio >= 0.6) {
    note = "The crew is finding its rhythm. Small starts are adding up.";
  } else if (recoveryRatio <= 0.25 && openTasks > 0) {
    note = "The pile is heavy right now. That’s the system, not any one person.";
  } else {
    note = "Steady enough. Each tiny start loosens the pressure a little.";
  }

  return { value, label, note };
}

export interface LoadMember {
  userId: string;
  name: string;
  openCount: number;
}

export interface LoadBalanceReport {
  counts: LoadMember[];
  heavy?: LoadMember;
  imbalanced: boolean;
}

export async function computeLoadBalance(
  workspaceId: string
): Promise<LoadBalanceReport> {
  const membershipRows = await db
    .select({
      userId: membershipTable.userId,
      name: userTable.name,
    })
    .from(membershipTable)
    .leftJoin(userTable, eq(userTable.id, membershipTable.userId))
    .where(eq(membershipTable.workspaceId, workspaceId))
    .orderBy(asc(membershipTable.joinedAt));

  if (membershipRows.length === 0) {
    return { counts: [], imbalanced: false };
  }

  const memberIds = membershipRows.map((m) => m.userId);

  const openTasks =
    memberIds.length > 0
      ? await db
          .select({ userId: taskTable.userId })
          .from(taskTable)
          .where(
            and(
              eq(taskTable.status, "open"),
              inArray(taskTable.userId, memberIds)
            )
          )
      : [];

  const counts: LoadMember[] = membershipRows.map((m) => ({
    userId: m.userId,
    name: m.name ?? "Someone",
    openCount: 0,
  }));
  for (const t of openTasks) {
    const member = counts.find((c) => c.userId === t.userId);
    if (member) member.openCount += 1;
  }

  const sorted = [...counts].sort((a, b) => b.openCount - a.openCount);
  const heavy = sorted[0];
  const light = sorted[sorted.length - 1];
  const imbalanced =
    counts.length >= 2 && heavy.openCount - light.openCount >= 2 && heavy.openCount >= 2;

  return { counts, heavy: imbalanced ? heavy : undefined, imbalanced };
}

export async function sumRecoveredMinutesThisWeek(userId: string): Promise<number> {
  const since = new Date(Date.now() - WEEK_MS);
  const rows = await db.query.userMetric.findMany({
    where: and(
      eq(userMetric.userId, userId),
      eq(userMetric.type, "recovered_minutes"),
      gte(userMetric.date, since)
    ),
    columns: { value: true },
  });
  return rows.reduce((sum, r) => sum + r.value, 0);
}

export interface DayBucket {
  date: Date;
  label: string;
  minutes: number;
}

export async function recoveredMinutesByDay(
  userId: string,
  days = 7
): Promise<DayBucket[]> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const buckets: DayBucket[] = [];
  const labels = ["S", "M", "T", "W", "T", "F", "S"];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(todayStart);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    buckets.push({
      date: dayStart,
      label: labels[dayStart.getDay()],
      minutes: 0,
    });
  }

  const since = buckets[0].date;
  const rows = await db.query.userMetric.findMany({
    where: and(
      eq(userMetric.userId, userId),
      eq(userMetric.type, "recovered_minutes"),
      gte(userMetric.date, since)
    ),
    columns: { value: true, date: true },
  });

  for (const row of rows) {
    const rowDay = startOfDay(row.date).getTime();
    const bucket = buckets.find((b) => b.date.getTime() === rowDay);
    if (bucket) bucket.minutes += row.value;
  }

  return buckets;
}
