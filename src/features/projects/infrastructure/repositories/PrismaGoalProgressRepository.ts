import { prisma } from "@/server/lib/prisma";
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
    const goals = await prisma.goal.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return goals.map(toSummary);
  }

  async findById(id: string): Promise<GoalSummary | null> {
    const goal = await prisma.goal.findUnique({ where: { id } });
    return goal ? toSummary(goal) : null;
  }

  async loadSnapshot(goalId: string): Promise<SmartGoalSnapshot | null> {
    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: {
        milestones: { orderBy: { dueDate: "asc" } },
        tasks: { orderBy: { createdAt: "desc" } },
        workspace: {
          select: {
            memberships: {
              include: { user: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });
    if (!goal) return null;

    return {
      goal: {
        id: goal.id,
        workspaceId: goal.workspaceId,
        ownerId: goal.ownerId,
        title: goal.title,
        specific: goal.specific,
        measurable: goal.measurable,
        achievable: goal.achievable,
        relevant: goal.relevant,
        deadline: goal.deadline,
        status: goal.status,
        createdAt: goal.createdAt,
      },
      milestones: goal.milestones.map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        dueDate: m.dueDate,
        createdAt: m.createdAt,
      })),
      tasks: goal.tasks.map((t) => ({
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
      members: goal.workspace.memberships.map((m) => ({
        userId: m.userId,
        name: m.user.name ?? "Someone",
      })),
    };
  }

  async create(input: CreateSmartGoalInput): Promise<GoalSummary> {
    const goal = await prisma.goal.create({
      data: {
        workspaceId: input.workspaceId,
        ownerId: input.ownerId,
        title: input.title,
        specific: input.specific ?? null,
        measurable: input.measurable ?? null,
        achievable: input.achievable ?? null,
        relevant: input.relevant ?? null,
        deadline: input.deadline ?? null,
        status: "active",
      },
    });
    return toSummary(goal);
  }

  async update(id: string, patch: UpdateSmartGoalInput): Promise<GoalSummary> {
    const goal = await prisma.goal.update({ where: { id }, data: patch });
    return toSummary(goal);
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
    const existing = await prisma.goal.findFirst({
      where: { workspaceId, status: "active" },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      const updated = await prisma.goal.update({
        where: { id: existing.id },
        data: {
          title: data.title,
          specific: data.specific ?? null,
          measurable: data.measurable ?? null,
          achievable: data.achievable ?? null,
          relevant: data.relevant ?? null,
          deadline: data.deadline ?? null,
        },
      });
      return toSummary(updated);
    }

    const created = await prisma.goal.create({
      data: {
        workspaceId,
        ownerId,
        title: data.title,
        specific: data.specific ?? null,
        measurable: data.measurable ?? null,
        achievable: data.achievable ?? null,
        relevant: data.relevant ?? null,
        deadline: data.deadline ?? null,
        status: "active",
      },
    });
    return toSummary(created);
  }
}

type PrismaGoalRow = Awaited<ReturnType<typeof prisma.goal.findUnique>> & {};
type PrismaGoalListRow = Awaited<ReturnType<typeof prisma.goal.findFirst>> & {};

function toSummary(goal: PrismaGoalRow | PrismaGoalListRow): GoalSummary {
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
