import { db } from "@/server/lib/db";
import {
  projectSmartGoal,
  smartGoalVersion,
  projectMethodology,
  membership,
  user,
  projectInvitation,
  projectKpi,
  projectKpiSnapshot,
  projectAiInsight,
  auditLog,
} from "@drizzle/schema";
import { eq, and, or, desc, asc, inArray, ne, sql, count } from "drizzle-orm";
import type {
  ProjectAiInsight,
  ProjectInvitation,
  ProjectKpi,
  ProjectMember,
  ProjectMethodologySelection,
  SmartGoal,
  SmartGoalVersion,
} from "../domain/entities";
import type {
  AddMemberInput,
  AuditEntry,
  IAuditRepository,
  IAiInsightRepository,
  IKpiRepository,
  IMemberRepository,
  IMethodologyRepository,
  ISmartGoalRepository,
  KpiConfigEntry,
  SaveSmartGoalInput,
  SetMethodologyInput,
  UpdateMemberInput,
} from "../domain/repositories";

function toDate(v: Date | null | undefined): string | null {
  return v ? v.toISOString() : null;
}

function tier(v: string): "primary" | "secondary" {
  return v === "primary" ? "primary" : "secondary";
}

/* -------------------------------------------------------------------------- */
/* SMART goal                                                                 */
/* -------------------------------------------------------------------------- */

export class PrismaSmartGoalRepository implements ISmartGoalRepository {
  async get(workspaceId: string): Promise<SmartGoal | null> {
    const row = await db.query.projectSmartGoal.findFirst({
      where: eq(projectSmartGoal.workspaceId, workspaceId),
    });
    if (!row) return null;
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      title: row.title,
      specific: row.specific,
      measurable: row.measurable,
      achievable: row.achievable,
      relevant: row.relevant,
      timeBound: row.timeBound,
      deadline: toDate(row.deadline),
      version: row.version,
      smartScore: row.smartScore,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async upsert(input: SaveSmartGoalInput): Promise<SmartGoal> {
    const deadline = input.deadline ? new Date(input.deadline) : null;
    const existing = await db.query.projectSmartGoal.findFirst({
      where: eq(projectSmartGoal.workspaceId, input.workspaceId),
    });

    if (!existing) {
      const [created] = await db
        .insert(projectSmartGoal)
        .values({
          workspaceId: input.workspaceId,
          title: input.title,
          specific: input.specific,
          measurable: input.measurable,
          achievable: input.achievable,
          relevant: input.relevant,
          timeBound: input.timeBound,
          deadline,
          version: 1,
          smartScore: input.smartScore,
        })
        .returning();
      await db.insert(smartGoalVersion).values({
        smartGoalId: created!.id,
        version: 1,
        title: created!.title,
        specific: created!.specific,
        measurable: created!.measurable,
        achievable: created!.achievable,
        relevant: created!.relevant,
        timeBound: created!.timeBound,
        deadline: created!.deadline,
        smartScore: created!.smartScore,
        changedById: input.changedById,
        changeNote: "Initial version",
      });
      return this.get(input.workspaceId) as Promise<SmartGoal>;
    }

    const nextVersion = existing.version + 1;
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(projectSmartGoal)
        .set({
          title: input.title,
          specific: input.specific,
          measurable: input.measurable,
          achievable: input.achievable,
          relevant: input.relevant,
          timeBound: input.timeBound,
          deadline,
          smartScore: input.smartScore,
          version: nextVersion,
        })
        .where(eq(projectSmartGoal.workspaceId, input.workspaceId))
        .returning();
      await tx.insert(smartGoalVersion).values({
        smartGoalId: row!.id,
        version: nextVersion,
        title: row!.title,
        specific: row!.specific,
        measurable: row!.measurable,
        achievable: row!.achievable,
        relevant: row!.relevant,
        timeBound: row!.timeBound,
        deadline: row!.deadline,
        smartScore: row!.smartScore,
        changedById: input.changedById,
      });
      return row!;
    });
    return {
      id: updated.id,
      workspaceId: updated.workspaceId,
      title: updated.title,
      specific: updated.specific,
      measurable: updated.measurable,
      achievable: updated.achievable,
      relevant: updated.relevant,
      timeBound: updated.timeBound,
      deadline: toDate(updated.deadline),
      version: updated.version,
      smartScore: updated.smartScore,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async listVersions(workspaceId: string): Promise<SmartGoalVersion[]> {
    const goal = await db.query.projectSmartGoal.findFirst({
      where: eq(projectSmartGoal.workspaceId, workspaceId),
    });
    if (!goal) return [];
    const rows = await db.query.smartGoalVersion.findMany({
      where: eq(smartGoalVersion.smartGoalId, goal.id),
      orderBy: [desc(smartGoalVersion.version)],
    });
    return rows.map((r) => ({
      id: r.id,
      version: r.version,
      title: r.title,
      specific: r.specific,
      measurable: r.measurable,
      achievable: r.achievable,
      relevant: r.relevant,
      timeBound: r.timeBound,
      deadline: toDate(r.deadline),
      smartScore: r.smartScore,
      changedById: r.changedById,
      changeNote: r.changeNote,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async restoreVersion(workspaceId: string, version: number, changedById: string): Promise<SmartGoal> {
    const goal = await db.query.projectSmartGoal.findFirst({
      where: eq(projectSmartGoal.workspaceId, workspaceId),
    });
    if (!goal) throw new Error("Smart goal not found");
    const v = await db.query.smartGoalVersion.findFirst({
      where: and(eq(smartGoalVersion.smartGoalId, goal.id), eq(smartGoalVersion.version, version)),
    });
    if (!v) throw new Error(`Version ${version} not found`);

    return this.upsert({
      workspaceId,
      title: v.title,
      specific: v.specific,
      measurable: v.measurable,
      achievable: v.achievable,
      relevant: v.relevant,
      timeBound: v.timeBound,
      deadline: toDate(v.deadline),
      smartScore: v.smartScore,
      changedById,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Methodology                                                                */
/* -------------------------------------------------------------------------- */

export class PrismaMethodologyRepository implements IMethodologyRepository {
  async list(workspaceId: string): Promise<ProjectMethodologySelection[]> {
    const rows = await db.query.projectMethodology.findMany({
      where: eq(projectMethodology.workspaceId, workspaceId),
    });
    return rows.map((r) => ({ id: r.id, methodologyKey: r.methodologyKey, tier: tier(r.tier) }));
  }

  async set(input: SetMethodologyInput): Promise<ProjectMethodologySelection[]> {
    await db.transaction(async (tx) => {
      await tx
        .delete(projectMethodology)
        .where(eq(projectMethodology.workspaceId, input.workspaceId));
      const rows: { methodologyKey: string; tier: string }[] = [];
      if (input.primary) rows.push({ methodologyKey: input.primary, tier: "primary" });
      for (const s of input.secondary) {
        if (s !== input.primary) rows.push({ methodologyKey: s, tier: "secondary" });
      }
      if (rows.length > 0) {
        await tx.insert(projectMethodology).values(
          rows.map((r) => ({ workspaceId: input.workspaceId, ...r }))
        );
      }
    });
    return this.list(input.workspaceId);
  }
}

/* -------------------------------------------------------------------------- */
/* Members                                                                    */
/* -------------------------------------------------------------------------- */

function toMember(row: {
  id: string;
  userId: string;
  projectRole: string | null;
  role: string;
  status: string;
  photoUrl: string | null;
  invitedEmail: string | null;
  joinedAt: Date;
  userName: string | null;
  userEmail: string | null;
}): ProjectMember {
  return {
    id: row.id,
    userId: row.userId,
    name: row.userName,
    email: row.userEmail ?? row.invitedEmail,
    photoUrl: row.photoUrl,
    projectRole: row.projectRole,
    permissionRole: row.role,
    status: (["active", "invited", "inactive"].includes(row.status) ? row.status : "active") as
      | "active"
      | "invited"
      | "inactive",
    joinedAt: row.joinedAt.toISOString(),
  };
}

const memberSelect = {
  id: membership.id,
  userId: membership.userId,
  projectRole: membership.projectRole,
  role: membership.role,
  status: membership.status,
  photoUrl: membership.photoUrl,
  invitedEmail: membership.invitedEmail,
  joinedAt: membership.joinedAt,
  userName: user.name,
  userEmail: user.email,
} as const;

async function fetchMember(id: string) {
  const rows = await db
    .select(memberSelect)
    .from(membership)
    .leftJoin(user, eq(user.id, membership.userId))
    .where(eq(membership.id, id))
    .limit(1);
  return rows[0];
}

export class PrismaMemberRepository implements IMemberRepository {
  async list(workspaceId: string): Promise<ProjectMember[]> {
    const rows = await db
      .select(memberSelect)
      .from(membership)
      .leftJoin(user, eq(user.id, membership.userId))
      .where(eq(membership.workspaceId, workspaceId))
      .orderBy(asc(membership.joinedAt));
    return rows.map(toMember);
  }

  async listInvitations(workspaceId: string): Promise<ProjectInvitation[]> {
    const rows = await db.query.projectInvitation.findMany({
      where: and(
        eq(projectInvitation.workspaceId, workspaceId),
        eq(projectInvitation.status, "pending")
      ),
      orderBy: [desc(projectInvitation.createdAt)],
    });
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      projectRole: r.projectRole,
      status: r.status as ProjectInvitation["status"],
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async add(input: AddMemberInput): Promise<ProjectMember> {
    if (!input.userId) throw new Error("userId is required to add a member");
    const [created] = await db
      .insert(membership)
      .values({
        workspaceId: input.workspaceId,
        userId: input.userId,
        role: input.permissionRole ?? "member",
        projectRole: input.projectRole ?? null,
        photoUrl: input.photoUrl ?? null,
        status: "active",
      })
      .returning();
    const row = await fetchMember(created!.id);
    return toMember(row!);
  }

  async update(memberId: string, input: UpdateMemberInput): Promise<ProjectMember> {
    const data: Record<string, unknown> = {};
    if (input.projectRole !== undefined) data.projectRole = input.projectRole;
    if (input.permissionRole) data.role = input.permissionRole;
    if (input.status) data.status = input.status;
    await db.update(membership).set(data).where(eq(membership.id, memberId));
    const row = await fetchMember(memberId);
    return toMember(row!);
  }

  async remove(memberId: string): Promise<void> {
    await db.delete(membership).where(eq(membership.id, memberId));
  }

  async countActiveLeaders(workspaceId: string): Promise<number> {
    const [row] = await db
      .select({ c: count() })
      .from(membership)
      .where(
        and(
          eq(membership.workspaceId, workspaceId),
          eq(membership.status, "active"),
          inArray(membership.role, ["leader", "admin"])
        )
      );
    return Number(row?.c ?? 0);
  }

  async emailExists(workspaceId: string, email: string, exceptMemberId?: string): Promise<boolean> {
    const normalized = email.trim().toLowerCase();
    const filters = [
      eq(membership.workspaceId, workspaceId),
      or(
        sql`lower(${membership.invitedEmail}) = ${normalized}`,
        sql`lower(${user.email}) = ${normalized}`
      ),
    ];
    if (exceptMemberId) filters.push(ne(membership.id, exceptMemberId));
    const member = await db
      .select({ id: membership.id })
      .from(membership)
      .leftJoin(user, eq(user.id, membership.userId))
      .where(and(...filters))
      .limit(1);
    if (member.length > 0) return true;
    const inv = await db.query.projectInvitation.findFirst({
      where: and(
        eq(projectInvitation.workspaceId, workspaceId),
        eq(projectInvitation.email, normalized)
      ),
      columns: { id: true },
    });
    return !!inv;
  }

  async invite(
    workspaceId: string,
    email: string,
    projectRole: string | null,
    invitedById: string
  ): Promise<ProjectInvitation> {
    const normalized = email.trim().toLowerCase();
    const [created] = await db
      .insert(projectInvitation)
      .values({
        workspaceId,
        email: normalized,
        projectRole,
        status: "pending",
        invitedById,
      })
      .onConflictDoUpdate({
        target: [projectInvitation.workspaceId, projectInvitation.email],
        set: { projectRole, status: "pending", invitedById },
      })
      .returning();
    return {
      id: created!.id,
      email: created!.email,
      projectRole: created!.projectRole,
      status: created!.status as ProjectInvitation["status"],
      createdAt: created!.createdAt.toISOString(),
    };
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    await db.delete(projectInvitation).where(eq(projectInvitation.id, invitationId));
  }
}

/* -------------------------------------------------------------------------- */
/* KPIs                                                                       */
/* -------------------------------------------------------------------------- */

export class PrismaKpiRepository implements IKpiRepository {
  async list(workspaceId: string): Promise<ProjectKpi[]> {
    const rows = await db.query.projectKpi.findMany({
      where: eq(projectKpi.workspaceId, workspaceId),
      orderBy: [asc(projectKpi.kpiKey)],
    });
    const withSnapshots = await Promise.all(
      rows.map((r) =>
        db.query.projectKpiSnapshot.findMany({
          where: eq(projectKpiSnapshot.projectKpiId, r.id),
          orderBy: [asc(projectKpiSnapshot.capturedAt)],
          limit: 90,
        })
      )
    );
    return rows.map((r, i) => ({
      id: r.id,
      kpiKey: r.kpiKey,
      enabled: r.enabled,
      target: r.target,
      alertThreshold: r.alertThreshold,
      snapshots: withSnapshots[i].map((s) => ({
        value: s.value,
        capturedAt: s.capturedAt.toISOString(),
      })),
    }));
  }

  async set(workspaceId: string, entries: KpiConfigEntry[]): Promise<ProjectKpi[]> {
    await db.transaction(async (tx) => {
      const keys = entries.map((e) => e.kpiKey);
      const existing = await tx.query.projectKpi.findMany({
        where: eq(projectKpi.workspaceId, workspaceId),
      });
      const existingKeys = new Set(existing.map((e) => e.kpiKey));

      for (const entry of entries) {
        const payload = {
          enabled: entry.enabled,
          target: entry.target ?? null,
          alertThreshold: entry.alertThreshold ?? null,
        };
        if (existingKeys.has(entry.kpiKey)) {
          await tx
            .update(projectKpi)
            .set(payload)
            .where(
              and(
                eq(projectKpi.workspaceId, workspaceId),
                eq(projectKpi.kpiKey, entry.kpiKey)
              )
            );
        } else {
          await tx.insert(projectKpi).values({ workspaceId, kpiKey: entry.kpiKey, ...payload });
        }
      }
      if (existingKeys.size > 0) {
        const toDisable = [...existingKeys].filter((k) => !keys.includes(k));
        if (toDisable.length) {
          await tx
            .update(projectKpi)
            .set({ enabled: false })
            .where(
              and(
                eq(projectKpi.workspaceId, workspaceId),
                inArray(projectKpi.kpiKey, toDisable)
              )
            );
        }
      }
    });
    return this.list(workspaceId);
  }

  async recordSnapshot(workspaceId: string, kpiKey: string, value: number): Promise<void> {
    const kpi = await db.query.projectKpi.findFirst({
      where: and(eq(projectKpi.workspaceId, workspaceId), eq(projectKpi.kpiKey, kpiKey)),
    });
    if (!kpi) return;
    await db.insert(projectKpiSnapshot).values({ projectKpiId: kpi.id, value });
  }
}

/* -------------------------------------------------------------------------- */
/* AI insights                                                                */
/* -------------------------------------------------------------------------- */

export class PrismaAiInsightRepository implements IAiInsightRepository {
  async list(workspaceId: string): Promise<ProjectAiInsight[]> {
    const rows = await db.query.projectAiInsight.findMany({
      where: eq(projectAiInsight.workspaceId, workspaceId),
      orderBy: [desc(projectAiInsight.createdAt)],
      limit: 60,
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type as ProjectAiInsight["type"],
      severity: r.severity as ProjectAiInsight["severity"],
      title: r.title,
      detail: r.detail,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async replace(
    workspaceId: string,
    insights: Array<{
      type: import("../domain/catalog").InsightType;
      severity: import("../domain/catalog").Severity | null;
      title: string;
      detail: string;
    }>
  ): Promise<ProjectAiInsight[]> {
    await db.transaction(async (tx) => {
      await tx.delete(projectAiInsight).where(eq(projectAiInsight.workspaceId, workspaceId));
      if (insights.length > 0) {
        await tx.insert(projectAiInsight).values(
          insights.map((i) => ({
            workspaceId,
            type: i.type,
            severity: i.severity,
            title: i.title,
            detail: i.detail,
          }))
        );
      }
    });
    return this.list(workspaceId);
  }
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                      */
/* -------------------------------------------------------------------------- */

export class PrismaAuditRepository implements IAuditRepository {
  async record(entry: AuditEntry): Promise<void> {
    await db.insert(auditLog).values({
      workspaceId: entry.workspaceId,
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: entry.before === undefined ? null : JSON.stringify(entry.before),
      after: entry.after === undefined ? null : JSON.stringify(entry.after),
    });
  }
}
