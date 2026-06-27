import { describe, expect, it } from "vitest";
import {
  recordRitualCompletion,
  recordTaskCompletion,
  computeWorkspaceMood,
  computeLoadBalance,
  sumRecoveredMinutesThisWeek,
  recoveredMinutesByDay,
} from "./metrics";
import { getTestDb, seedMember, seedUser } from "@/tests/helpers/db";
import { eq, and, count } from "drizzle-orm";
import {
  task as taskTable,
  ritualSession,
  userMetric,
  teamMetric as teamMetricTable,
} from "@drizzle/schema";

async function seedTaskAndRitual(userId: string, estimatedMinutes?: number) {
  const db = await getTestDb();
  const [taskRow] = await db
    .insert(taskTable)
    .values({
      userId,
      title: "Test task",
      fromQuote: "“test”",
      category: "General",
      app: "Knowledge base",
      micro: "Do the first tiny thing",
      action: "first tiny thing",
      status: "open",
      estimatedMinutes,
    })
    .returning();
  const [ritualRow] = await db
    .insert(ritualSession)
    .values({
      userId,
      taskId: taskRow!.id,
      durationSec: 120,
      startedAt: new Date(),
    })
    .returning();
  return { task: taskRow!, ritual: ritualRow! };
}

describe("recordRitualCompletion", () => {
  it("writes user metrics and updates recoveredMinutes on the ritual", async () => {
    const { user } = await seedUser();
    const { ritual, task } = await seedTaskAndRitual(user.id, 20);

    const result = await recordRitualCompletion({
      userId: user.id,
      ritualId: ritual.id,
      taskId: task.id,
      durationSec: 120,
    });

    expect(result.recoveredMinutes).toBe(20);

    const db = await getTestDb();
    const updated = await db.query.ritualSession.findFirst({
      where: eq(ritualSession.id, ritual.id),
    });
    expect(updated?.recoveredMinutes).toBe(20);

    const ritualsRows = await db
      .select({ c: count() })
      .from(userMetric)
      .where(
        and(eq(userMetric.userId, user.id), eq(userMetric.type, "rituals_completed"))
      );
    expect(ritualsRows[0].c).toBe(1);

    const recovered = await db.query.userMetric.findFirst({
      where: and(eq(userMetric.userId, user.id), eq(userMetric.type, "recovered_minutes")),
    });
    expect(recovered?.value).toBe(20);

    const tasksRows = await db
      .select({ c: count() })
      .from(userMetric)
      .where(
        and(eq(userMetric.userId, user.id), eq(userMetric.type, "tasks_completed"))
      );
    expect(tasksRows[0].c).toBe(1);
  });

  it("falls back to duration when task has no estimatedMinutes", async () => {
    const { user } = await seedUser();
    const { ritual, task } = await seedTaskAndRitual(user.id);

    const result = await recordRitualCompletion({
      userId: user.id,
      ritualId: ritual.id,
      taskId: task.id,
      durationSec: 120,
    });

    expect(result.recoveredMinutes).toBe(2);
  });

  it("writes a team recovered_minutes metric when the user has a membership", async () => {
    const { user, workspaceId } = await seedMember();
    const { ritual, task } = await seedTaskAndRitual(user.id, 15);

    await recordRitualCompletion({
      userId: user.id,
      ritualId: ritual.id,
      taskId: task.id,
      durationSec: 120,
    });

    const db = await getTestDb();
    const teamMetric = await db.query.teamMetric.findFirst({
      where: and(
        eq(teamMetricTable.workspaceId, workspaceId),
        eq(teamMetricTable.type, "recovered_minutes")
      ),
    });
    expect(teamMetric?.value).toBe(15);
  });

  it("does not write tasks_completed when there is no taskId", async () => {
    const { user } = await seedUser();
    const db = await getTestDb();
    const [ritual] = await db
      .insert(ritualSession)
      .values({ userId: user.id, durationSec: 120, startedAt: new Date() })
      .returning();

    await recordRitualCompletion({
      userId: user.id,
      ritualId: ritual!.id,
      durationSec: 120,
    });

    const tasksRows = await db
      .select({ c: count() })
      .from(userMetric)
      .where(
        and(eq(userMetric.userId, user.id), eq(userMetric.type, "tasks_completed"))
      );
    expect(tasksRows[0].c).toBe(0);
  });
});

describe("recordTaskCompletion", () => {
  it("writes a tasks_completed user metric", async () => {
    const { user } = await seedUser();
    await recordTaskCompletion(user.id);

    const db = await getTestDb();
    const rows = await db
      .select({ c: count() })
      .from(userMetric)
      .where(
        and(eq(userMetric.userId, user.id), eq(userMetric.type, "tasks_completed"))
      );
    const metricCount = rows[0].c;
    expect(metricCount).toBe(1);
  });
});

describe("computeWorkspaceMood", () => {
  it("returns a steady mood when there are no tasks or rituals", async () => {
    const { workspaceId } = await seedMember();
    const mood = await computeWorkspaceMood(workspaceId);
    expect(mood.value).toBeGreaterThan(0);
    expect(mood.label).toBeTruthy();
  });

  it("returns a higher mood when rituals are completed vs open tasks", async () => {
    const { user, workspaceId } = await seedMember();
    const db = await getTestDb();
    await db.insert(ritualSession).values({
      userId: user.id,
      completedAt: new Date(),
      startedAt: new Date(),
    });

    const mood = await computeWorkspaceMood(workspaceId);
    expect(mood.value).toBeGreaterThanOrEqual(0.5);
  });
});

describe("computeLoadBalance", () => {
  it("detects imbalance when one member carries many more tasks", async () => {
    const heavy = await seedMember({ name: "Heavy" });
    await seedMember({
      name: "Light",
      workspaceId: heavy.workspaceId,
    });
    const db = await getTestDb();

    for (let i = 0; i < 3; i++) {
      await db.insert(taskTable).values({
        userId: heavy.user.id,
        title: `Heavy task ${i}`,
        micro: "tiny",
        action: "tiny",
        status: "open",
      });
    }

    const report = await computeLoadBalance(heavy.workspaceId);
    expect(report.imbalanced).toBe(true);
    expect(report.heavy?.userId).toBe(heavy.user.id);
    expect(report.heavy?.openCount).toBe(3);
  });

  it("is not imbalanced when load is even", async () => {
    const a = await seedMember({ name: "A" });
    const b = await seedMember({ name: "B", workspaceId: a.workspaceId });
    const db = await getTestDb();
    await db.insert(taskTable).values({
      userId: a.user.id,
      title: "a",
      micro: "m",
      action: "a",
      status: "open",
    });
    await db.insert(taskTable).values({
      userId: b.user.id,
      title: "b",
      micro: "m",
      action: "b",
      status: "open",
    });

    const report = await computeLoadBalance(a.workspaceId);
    expect(report.imbalanced).toBe(false);
  });
});

describe("sumRecoveredMinutesThisWeek", () => {
  it("sums recovered_minutes metrics from the last 7 days", async () => {
    const { user } = await seedUser();
    const db = await getTestDb();
    await db.insert(userMetric).values({
      userId: user.id,
      type: "recovered_minutes",
      value: 20,
      date: new Date(),
    });
    await db.insert(userMetric).values({
      userId: user.id,
      type: "recovered_minutes",
      value: 5,
      date: new Date(),
    });

    const total = await sumRecoveredMinutesThisWeek(user.id);
    expect(total).toBe(25);
  });
});

describe("recoveredMinutesByDay", () => {
  it("returns 7 buckets labeled by weekday", async () => {
    const { user } = await seedUser();
    const buckets = await recoveredMinutesByDay(user.id, 7);
    expect(buckets).toHaveLength(7);
    expect(buckets.every((b) => b.label.length === 1)).toBe(true);
  });

  it("places today's recovered minutes in the last bucket", async () => {
    const { user } = await seedUser();
    const db = await getTestDb();
    await db.insert(userMetric).values({
      userId: user.id,
      type: "recovered_minutes",
      value: 30,
      date: new Date(),
    });

    const buckets = await recoveredMinutesByDay(user.id, 7);
    expect(buckets[buckets.length - 1].minutes).toBe(30);
  });
});
