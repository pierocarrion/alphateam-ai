import { eq, and, or, asc, desc, inArray, gte, count } from "drizzle-orm";
import { db } from "@/server/lib/db";
import {
  workspace,
  membership,
  user,
  task,
  message,
  channel,
  goal,
  feedback,
  survey,
  dailyCheckIn,
  learningActivity,
  employeeSkill,
  meeting,
} from "@drizzle/schema";
import type {
  ITeamInsightsRepository,
  RawCheckInRow,
  RawFeedbackRow,
  RawSurveyRow,
  RawTaskRow,
  EmployeeActivityRow,
} from "../../domain/repositories/ITeamInsightsRepository";
import type { EmployeeWithMetrics } from "../../domain/entities/Employee";
import type { LearningActivity, SkillCell, SkillLevel } from "../../domain/entities/Learning";
import type { TeamInsightsFilters } from "../../domain/entities/TeamOverview";
import type { EmotionalState, Seniority } from "../../domain/entities/Employee";

function toSkillLevel(level: string | null | undefined): SkillLevel {
  if (level === "beginner" || level === "intermediate" || level === "advanced" || level === "expert") {
    return level;
  }
  return "beginner";
}

function toSentiment(score: number): EmotionalState {
  if (score >= 66) return "positive";
  if (score >= 40) return "neutral";
  return "risk";
}

export class PrismaTeamInsightsRepository implements ITeamInsightsRepository {
  async getTeamName(workspaceId: string): Promise<string> {
    const rows = await db
      .select({ name: workspace.name })
      .from(workspace)
      .where(eq(workspace.id, workspaceId))
      .limit(1);
    return rows[0]?.name ?? "Equipo";
  }

  async listMembers(
    workspaceId: string,
    filters?: TeamInsightsFilters
  ): Promise<EmployeeWithMetrics[]> {
    const conditions = [
      eq(membership.workspaceId, workspaceId),
      eq(membership.status, "active"),
    ];
    if (filters?.seniority) {
      conditions.push(eq(membership.seniority, filters.seniority));
    }
    if (filters?.position) {
      conditions.push(eq(membership.projectRole, filters.position));
    }

    const rows = await db
      .select({
        userId: membership.userId,
        role: membership.role,
        projectRole: membership.projectRole,
        seniority: membership.seniority,
        hireDate: membership.hireDate,
        joinedAt: membership.joinedAt,
        photoUrl: membership.photoUrl,
        userName: user.name,
        userImage: user.image,
      })
      .from(membership)
      .leftJoin(user, eq(user.id, membership.userId))
      .where(and(...conditions))
      .orderBy(asc(membership.joinedAt));

    const since = filters?.since ? new Date(filters.since) : undefined;

    const [tasks, surveys, feedbackRows, learning] = await Promise.all([
      this.listTasks(workspaceId, since),
      this.listSurveys(workspaceId, since),
      this.listFeedback(workspaceId, since),
      this.listLearning(workspaceId, since),
    ]);

    const members = rows.map((m) => {
      const memberTasks = tasks.filter((t) => t.userId === m.userId);
      const memberSurveys = surveys.filter((s) => s.userId === m.userId);
      const memberFeedback = feedbackRows.filter((f) => f.userId === m.userId);
      const memberLearning = learning.filter((l) => l.employeeId === m.userId);

      const completedTasks = memberTasks.filter(
        (t) => t.status === "done" || t.status === "completed"
      ).length;
      const activeTasks = memberTasks.filter(
        (t) => t.status !== "done" && t.status !== "completed"
      ).length;
      const estimatedHours =
        memberTasks.reduce((a, t) => a + (t.estimatedMinutes ?? 0), 0) / 60;
      const workedHours =
        memberTasks.reduce((a, t) => a + (t.workedMinutes ?? 0), 0) / 60;
      const progressPct =
        memberTasks.length === 0
          ? 0
          : Math.round((completedTasks / memberTasks.length) * 1000) / 10;
      const learningProgress =
        memberLearning.length === 0
          ? 0
          : Math.round(
              (memberLearning.filter((l) => l.completedAt).length /
                memberLearning.length) *
                1000
            ) / 10;

      const positive =
        memberSurveys.filter((s) => s.sentiment === "positive").length +
        memberFeedback.filter((f) => (f.score ?? 0) >= 4).length;
      const risk =
        memberSurveys.filter((s) => s.sentiment === "risk").length +
        memberFeedback.filter((f) => (f.score ?? 0) <= 2).length;
      const total = memberSurveys.length + memberFeedback.length;
      const sentimentScore =
        total === 0 ? 0 : Math.round((50 + ((positive - risk) / total) * 50) * 10) / 10;
      const sentiment = toSentiment(sentimentScore);

      const employee: EmployeeWithMetrics = {
        id: m.userId,
        name: m.userName ?? "Colaborador",
        photo: m.photoUrl ?? m.userImage ?? null,
        position: m.projectRole ?? null,
        team: workspaceId,
        role: m.role,
        seniority: (m.seniority as Seniority | null) ?? null,
        hireDate: m.hireDate ?? m.joinedAt,
        employeeId: m.userId,
        activeTasks,
        completedTasks,
        workedHours: Math.round(workedHours * 10) / 10,
        estimatedHours: Math.round(estimatedHours * 10) / 10,
        progressPct,
        learningProgress,
        sentimentScore,
        sentiment,
        sentimentHasData: total > 0,
      };
      return employee;
    });

    return this.applyPostFilters(members, filters);
  }

  private applyPostFilters(
    members: EmployeeWithMetrics[],
    filters?: TeamInsightsFilters
  ): EmployeeWithMetrics[] {
    let result = members;
    if (filters?.sentiment) {
      result = result.filter((m) => m.sentiment === filters.sentiment);
    }
    return result;
  }

  async listTasks(workspaceId: string, since?: Date): Promise<RawTaskRow[]> {
    const conditions = [
      or(
        eq(channel.workspaceId, workspaceId),
        eq(goal.workspaceId, workspaceId)
      ),
    ];
    if (since) {
      conditions.push(gte(task.createdAt, since));
    }
    const rows = await db
      .select({
        id: task.id,
        userId: task.userId,
        status: task.status,
        estimatedMinutes: task.estimatedMinutes,
        workedMinutes: task.workedMinutes,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        deadline: task.deadline,
      })
      .from(task)
      .leftJoin(message, eq(message.id, task.messageId))
      .leftJoin(channel, eq(channel.id, message.channelId))
      .leftJoin(goal, eq(goal.id, task.smartGoalId))
      .where(and(...conditions));
    return rows as RawTaskRow[];
  }

  async listFeedback(workspaceId: string, since?: Date): Promise<RawFeedbackRow[]> {
    const conditions = [eq(feedback.workspaceId, workspaceId)];
    if (since) {
      conditions.push(gte(feedback.createdAt, since));
    }
    const rows = await db
      .select({
        userId: feedback.userId,
        type: feedback.type,
        metricValue: feedback.metricValue,
        createdAt: feedback.createdAt,
      })
      .from(feedback)
      .where(and(...conditions));
    return rows.map((r) => ({
      userId: r.userId,
      score: r.metricValue,
      metricValue: r.metricValue,
      type: r.type,
      createdAt: r.createdAt,
    }));
  }

  async listSurveys(workspaceId: string, since?: Date): Promise<RawSurveyRow[]> {
    const conditions = [eq(survey.workspaceId, workspaceId)];
    if (since) {
      conditions.push(gte(survey.createdAt, since));
    }
    const rows = await db
      .select({
        userId: survey.userId,
        psychologicalSafety: survey.psychologicalSafety,
        sentiment: survey.sentiment,
        createdAt: survey.createdAt,
      })
      .from(survey)
      .where(and(...conditions));
    return rows as RawSurveyRow[];
  }

  async listCheckIns(workspaceId: string, since?: Date): Promise<RawCheckInRow[]> {
    const memberRows = await db
      .select({ userId: membership.userId })
      .from(membership)
      .where(eq(membership.workspaceId, workspaceId));
    const memberIds = memberRows.map((r) => r.userId);
    if (memberIds.length === 0) return [];

    const conditions = [inArray(dailyCheckIn.userId, memberIds)];
    if (since) {
      conditions.push(gte(dailyCheckIn.date, since));
    }
    const rows = await db
      .select({
        userId: dailyCheckIn.userId,
        date: dailyCheckIn.date,
        mood: dailyCheckIn.mood,
        energy: dailyCheckIn.energy,
      })
      .from(dailyCheckIn)
      .where(and(...conditions));
    return rows as RawCheckInRow[];
  }

  async listLearning(
    workspaceId: string,
    since?: Date
  ): Promise<LearningActivity[]> {
    const conditions = [eq(learningActivity.workspaceId, workspaceId)];
    if (since) {
      conditions.push(gte(learningActivity.createdAt, since));
    }
    const rows = await db
      .select({
        id: learningActivity.id,
        userId: learningActivity.userId,
        type: learningActivity.type,
        title: learningActivity.title,
        skill: learningActivity.skill,
        level: learningActivity.level,
        hours: learningActivity.hours,
        completedAt: learningActivity.completedAt,
        createdAt: learningActivity.createdAt,
      })
      .from(learningActivity)
      .where(and(...conditions))
      .orderBy(asc(learningActivity.createdAt));
    return rows.map((r) => ({
      id: r.id,
      employeeId: r.userId,
      type: r.type,
      title: r.title,
      skill: r.skill,
      level: toSkillLevel(r.level),
      hours: r.hours,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
    }));
  }

  async listSkills(workspaceId: string): Promise<SkillCell[]> {
    const rows = await db
      .select({
        userId: employeeSkill.userId,
        skill: employeeSkill.skill,
        level: employeeSkill.level,
        userName: user.name,
      })
      .from(employeeSkill)
      .leftJoin(user, eq(user.id, employeeSkill.userId))
      .where(eq(employeeSkill.workspaceId, workspaceId));
    return rows.map((r) => ({
      employeeId: r.userId,
      employeeName: r.userName ?? "Colaborador",
      skill: r.skill,
      level: toSkillLevel(r.level),
    }));
  }

  async listMeetingsAttended(
    workspaceId: string,
    since?: Date
  ): Promise<RawCheckInRow[]> {
    return this.listCheckIns(workspaceId, since);
  }

  async countMeetingsTotal(workspaceId: string, since?: Date): Promise<number> {
    const conditions = [eq(meeting.workspaceId, workspaceId)];
    if (since) {
      conditions.push(gte(meeting.createdAt, since));
    }
    const rows = await db
      .select({ c: count() })
      .from(meeting)
      .where(and(...conditions));
    return Number(rows[0]?.c ?? 0);
  }

  async listEmployeeActivity(
    workspaceId: string,
    employeeId: string,
    limit = 30
  ): Promise<EmployeeActivityRow[]> {
    const [learning, tasks, feedbackRows, meetings] = await Promise.all([
      db
        .select({
          id: learningActivity.id,
          type: learningActivity.type,
          title: learningActivity.title,
          completedAt: learningActivity.completedAt,
          createdAt: learningActivity.createdAt,
        })
        .from(learningActivity)
        .where(
          and(
            eq(learningActivity.workspaceId, workspaceId),
            eq(learningActivity.userId, employeeId)
          )
        )
        .orderBy(desc(learningActivity.createdAt))
        .limit(limit),
      db
        .select({
          id: task.id,
          title: task.title,
          status: task.status,
          createdAt: task.createdAt,
          completedAt: task.completedAt,
        })
        .from(task)
        .leftJoin(message, eq(message.id, task.messageId))
        .leftJoin(channel, eq(channel.id, message.channelId))
        .leftJoin(goal, eq(goal.id, task.smartGoalId))
        .where(
          and(
            eq(task.userId, employeeId),
            inArray(task.status, ["done", "completed"]),
            or(
              eq(channel.workspaceId, workspaceId),
              eq(goal.workspaceId, workspaceId)
            )
          )
        )
        .orderBy(desc(task.completedAt))
        .limit(limit),
      db
        .select({
          id: feedback.id,
          type: feedback.type,
          content: feedback.content,
          createdAt: feedback.createdAt,
        })
        .from(feedback)
        .where(
          and(
            eq(feedback.workspaceId, workspaceId),
            eq(feedback.userId, employeeId)
          )
        )
        .orderBy(desc(feedback.createdAt))
        .limit(limit),
      db
        .select({
          id: meeting.id,
          title: meeting.title,
          status: meeting.status,
          scheduledAt: meeting.scheduledAt,
          createdAt: meeting.createdAt,
        })
        .from(meeting)
        .where(
          and(
            eq(meeting.workspaceId, workspaceId),
            eq(meeting.ownerId, employeeId)
          )
        )
        .orderBy(desc(meeting.createdAt))
        .limit(limit),
    ]);

    const activity: EmployeeActivityRow[] = [];
    for (const l of learning) {
      activity.push({
        id: l.id,
        type: l.type === "certification" ? "certification" : "course",
        title: l.title,
        detail: l.completedAt ? "Completado" : "En progreso",
        occurredAt: l.completedAt ?? l.createdAt,
      });
    }
    for (const t of tasks) {
      activity.push({
        id: t.id,
        type: "task",
        title: t.title,
        detail: "Tarea finalizada",
        occurredAt: t.completedAt ?? t.createdAt,
      });
    }
    for (const f of feedbackRows) {
      activity.push({
        id: f.id,
        type: "feedback",
        title: f.content.slice(0, 80),
        detail: f.type,
        occurredAt: f.createdAt,
      });
    }
    for (const mt of meetings) {
      activity.push({
        id: mt.id,
        type: "meeting",
        title: mt.title,
        detail: mt.status,
        occurredAt: mt.scheduledAt ?? mt.createdAt,
      });
    }
    return activity.sort(
      (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()
    );
  }
}
