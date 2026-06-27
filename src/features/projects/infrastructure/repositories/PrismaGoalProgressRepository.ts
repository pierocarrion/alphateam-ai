import { db } from "@/server/lib/db";
import { goal, milestone, task, projectTask, membership, user } from "@drizzle/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import type { SmartGoalSnapshot } from "../../domain/entities/SmartGoal";
import {
  CreateSmartGoalInput,
  GoalSummary,
  IGoalProgressRepository,
  UpdateSmartGoalInput,
} from "../../domain/repositories/IGoalProgressRepository";

/**
 * Prisma implementation of the SMART Goal Progress Tracker repository.
 *
 * Maps Prisma rows to domain records with private to*() helpers, mirroring the
 * convention used by PrismaProjectRepository.
 */
export class PrismaGoalProgressRepository implements IGoalProgressRepository {
  async listForWorkspace(workspaceId: string): Promise<GoalSummary[]> {
    const goals = await db.query.goal.findMany({
      where: eq(goal.workspaceId, workspaceId),
      orderBy: [desc(goal.createdAt)],
    });
    return goals.map(toSummary);
  }

  async findById(id: string): Promise<GoalSummary | null> {
    const goalRow = await db.query.goal.findFirst({ where: eq(goal.id, id) });
    return goalRow ? toSummary(goalRow) : null;
  }

  async loadSnapshot(goalId: string): Promise<SmartGoalSnapshot | null> {
    const goalRow = await db.query.goal.findFirst({
      where: eq(goal.id, goalId),
    });
    if (!goalRow) return null;

    const [milestones, tasks, projectTasks, memberRows] = await Promise.all([
      db.query.milestone.findMany({
        where: eq(milestone.goalId, goalId),
        orderBy: [asc(milestone.dueDate)],
      }),
      db.query.task.findMany({
        where: eq(task.smartGoalId, goalId),
        orderBy: [desc(task.createdAt)],
      }),
      db.query.projectTask.findMany({
        where: eq(projectTask.workspaceId, goalRow.workspaceId),
        orderBy: [desc(projectTask.createdAt)],
      }),
      db
        .select({
          userId: membership.userId,
          name: user.name,
        })
        .from(membership)
        .leftJoin(user, eq(user.id, membership.userId))
        .where(eq(membership.workspaceId, goalRow.workspaceId)),
    ]);

    return {
      goal: {
        id: goalRow.id,
        workspaceId: goalRow.workspaceId,
        ownerId: goalRow.ownerId,
        title: goalRow.title,
        specific: goalRow.specific,
        measurable: goalRow.measurable,
        achievable: goalRow.achievable,
        relevant: goalRow.relevant,
        deadline: goalRow.deadline,
        status: goalRow.status,
        createdAt: goalRow.createdAt,
      },
      milestones: milestones.map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        dueDate: m.dueDate,
        createdAt: m.createdAt,
      })),
      tasks: [
        ...tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status === "done" ? "done" : "open",
          userId: t.userId,
          load: t.load,
          estimatedMinutes: t.estimatedMinutes,
          priority: t.priority,
          createdAt: t.createdAt,
          completedAt: t.completedAt,
        })),
        ...projectTasks.map((pt) => ({
          id: `pt_${pt.id}`,
          title: pt.title,
          status: pt.status === "done" ? "done" : "open",
          userId: pt.assigneeId ?? pt.createdById,
          load: priorityToLoad(pt.priority),
          estimatedMinutes: null,
          priority: null,
          createdAt: pt.createdAt,
          completedAt: pt.completedAt,
        })),
      ],
      members: memberRows.map((m) => ({
        userId: m.userId,
        name: m.name ?? "Someone",
      })),
    };
  }

  async create(input: CreateSmartGoalInput): Promise<GoalSummary> {
    const [goalRow] = await db
      .insert(goal)
      .values({
        workspaceId: input.workspaceId,
        ownerId: input.ownerId,
        title: input.title,
        specific: input.specific ?? null,
        measurable: input.measurable ?? null,
        achievable: input.achievable ?? null,
        relevant: input.relevant ?? null,
        deadline: input.deadline ?? null,
        status: "active",
      })
      .returning();
    return toSummary(goalRow!);
  }

  async update(id: string, patch: UpdateSmartGoalInput): Promise<GoalSummary> {
    const [goalRow] = await db
      .update(goal)
      .set({ ...patch })
      .where(eq(goal.id, id))
      .returning();
    return toSummary(goalRow!);
  }

  async upsertActiveGoal(
    workspaceId: string,
    ownerId: string,
    data: {
      title: string;
      specific?: string | null;
      measurable?: string | null;
      achievable?: string | null;
      relevant?: string | null;
      deadline?: Date | null;
    }
  ): Promise<GoalSummary> {
    const existing = await db.query.goal.findFirst({
      where: and(eq(goal.workspaceId, workspaceId), eq(goal.status, "active")),
      orderBy: [desc(goal.createdAt)],
    });

    if (existing) {
      const [updated] = await db
        .update(goal)
        .set({
          title: data.title,
          specific: data.specific ?? null,
          measurable: data.measurable ?? null,
          achievable: data.achievable ?? null,
          relevant: data.relevant ?? null,
          deadline: data.deadline ?? null,
        })
        .where(eq(goal.id, existing.id))
        .returning();
      return toSummary(updated!);
    }

    const [created] = await db
      .insert(goal)
      .values({
        workspaceId,
        ownerId,
        title: data.title,
        specific: data.specific ?? null,
        measurable: data.measurable ?? null,
        achievable: data.achievable ?? null,
        relevant: data.relevant ?? null,
        deadline: data.deadline ?? null,
        status: "active",
      })
      .returning();
    return toSummary(created!);
  }
}

type GoalRow = {
  id: string;
  workspaceId: string;
  title: string;
  status: string;
  ownerId: string;
  deadline: Date | null;
  createdAt: Date;
};

function toSummary(goal: GoalRow): GoalSummary {
  return {
    id: goal.id,
    workspaceId: goal.workspaceId,
    title: goal.title,
    status: goal.status,
    ownerId: goal.ownerId,
    deadline: goal.deadline,
    createdAt: goal.createdAt,
  };
}

/** Maps a ProjectTask priority (low|medium|high|urgent) to a SmartTask load. */
function priorityToLoad(priority: string | null): string {
  switch (priority) {
    case "high":
    case "urgent":
      return "Heavy";
    case "medium":
      return "Medium";
    default:
      return "Light";
  }
}
