import { prisma } from "@/server/lib/prisma";
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
    const row = await prisma.projectSmartGoal.findUnique({ where: { workspaceId } });
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
    const existing = await prisma.projectSmartGoal.findUnique({
      where: { workspaceId: input.workspaceId },
    });

    if (!existing) {
      const created = await prisma.projectSmartGoal.create({
        data: {
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
        },
      });
      await prisma.smartGoalVersion.create({
        data: {
          smartGoalId: created.id,
          version: 1,
          title: created.title,
          specific: created.specific,
          measurable: created.measurable,
          achievable: created.achievable,
          relevant: created.relevant,
          timeBound: created.timeBound,
          deadline: created.deadline,
          smartScore: created.smartScore,
          changedById: input.changedById,
          changeNote: "Initial version",
        },
      });
      return this.get(input.workspaceId) as Promise<SmartGoal>;
    }

    const nextVersion = existing.version + 1;
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.projectSmartGoal.update({
        where: { workspaceId: input.workspaceId },
        data: {
          title: input.title,
          specific: input.specific,
          measurable: input.measurable,
          achievable: input.achievable,
          relevant: input.relevant,
          timeBound: input.timeBound,
          deadline,
          smartScore: input.smartScore,
          version: nextVersion,
        },
      });
      await tx.smartGoalVersion.create({
        data: {
          smartGoalId: row.id,
          version: nextVersion,
          title: row.title,
          specific: row.specific,
          measurable: row.measurable,
          achievable: row.achievable,
          relevant: row.relevant,
          timeBound: row.timeBound,
          deadline: row.deadline,
          smartScore: row.smartScore,
          changedById: input.changedById,
        },
      });
      return row;
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
    const goal = await prisma.projectSmartGoal.findUnique({ where: { workspaceId } });
    if (!goal) return [];
    const rows = await prisma.smartGoalVersion.findMany({
      where: { smartGoalId: goal.id },
      orderBy: { version: "desc" },
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
    const goal = await prisma.projectSmartGoal.findUnique({ where: { workspaceId } });
    if (!goal) throw new Error("Smart goal not found");
    const v = await prisma.smartGoalVersion.findFirst({
      where: { smartGoalId: goal.id, version },
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
    const rows = await prisma.projectMethodology.findMany({ where: { workspaceId } });
    return rows.map((r) => ({ id: r.id, methodologyKey: r.methodologyKey, tier: tier(r.tier) }));
  }

  async set(input: SetMethodologyInput): Promise<ProjectMethodologySelection[]> {
    await prisma.$transaction(async (tx) => {
      await tx.projectMethodology.deleteMany({ where: { workspaceId: input.workspaceId } });
      const rows: { methodologyKey: string; tier: string }[] = [];
      if (input.primary) rows.push({ methodologyKey: input.primary, tier: "primary" });
      for (const s of input.secondary) {
        if (s !== input.primary) rows.push({ methodologyKey: s, tier: "secondary" });
      }
      if (rows.length > 0) {
        await tx.projectMethodology.createMany({
          data: rows.map((r) => ({ workspaceId: input.workspaceId, ...r })),
        });
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
  user: { name: string | null; email: string | null };
}): ProjectMember {
  return {
    id: row.id,
    userId: row.userId,
    name: row.user.name,
    email: row.user.email ?? row.invitedEmail,
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

export class PrismaMemberRepository implements IMemberRepository {
  async list(workspaceId: string): Promise<ProjectMember[]> {
    const rows = await prisma.membership.findMany({
      where: { workspaceId },
      orderBy: { joinedAt: "asc" },
      include: { user: { select: { name: true, email: true } } },
    });
    return rows.map(toMember);
  }

  async listInvitations(workspaceId: string): Promise<ProjectInvitation[]> {
    const rows = await prisma.projectInvitation.findMany({
      where: { workspaceId, status: "pending" },
      orderBy: { createdAt: "desc" },
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
    const created = await prisma.membership.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        role: input.permissionRole ?? "member",
        projectRole: input.projectRole ?? null,
        photoUrl: input.photoUrl ?? null,
        status: "active",
      },
      include: { user: { select: { name: true, email: true } } },
    });
    return toMember(created);
  }

  async update(memberId: string, input: UpdateMemberInput): Promise<ProjectMember> {
    const data: Record<string, unknown> = {};
    if (input.projectRole !== undefined) data.projectRole = input.projectRole;
    if (input.permissionRole) data.role = input.permissionRole;
    if (input.status) data.status = input.status;
    const updated = await prisma.membership.update({
      where: { id: memberId },
      data,
      include: { user: { select: { name: true, email: true } } },
    });
    return toMember(updated);
  }

  async remove(memberId: string): Promise<void> {
    await prisma.membership.delete({ where: { id: memberId } });
  }

  async countActiveLeaders(workspaceId: string): Promise<number> {
    const count = await prisma.membership.count({
      where: {
        workspaceId,
        status: "active",
        role: { in: ["leader", "admin"] },
      },
    });
    return count;
  }

  async emailExists(workspaceId: string, email: string, exceptMemberId?: string): Promise<boolean> {
    const normalized = email.trim().toLowerCase();
    const member = await prisma.membership.findFirst({
      where: {
        workspaceId,
        ...(exceptMemberId ? { id: { not: exceptMemberId } } : {}),
        OR: [
          { invitedEmail: { equals: normalized, mode: "insensitive" } },
          { user: { email: { equals: normalized, mode: "insensitive" } } },
        ],
      },
      select: { id: true },
    });
    if (member) return true;
    const inv = await prisma.projectInvitation.findUnique({
      where: { workspaceId_email: { workspaceId, email: normalized } },
      select: { id: true },
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
    const created = await prisma.projectInvitation.upsert({
      where: { workspaceId_email: { workspaceId, email: normalized } },
      create: {
        workspaceId,
        email: normalized,
        projectRole,
        status: "pending",
        invitedById,
      },
      update: { projectRole, status: "pending", invitedById },
    });
    return {
      id: created.id,
      email: created.email,
      projectRole: created.projectRole,
      status: created.status as ProjectInvitation["status"],
      createdAt: created.createdAt.toISOString(),
    };
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    await prisma.projectInvitation.delete({ where: { id: invitationId } });
  }
}

/* -------------------------------------------------------------------------- */
/* KPIs                                                                       */
/* -------------------------------------------------------------------------- */

export class PrismaKpiRepository implements IKpiRepository {
  async list(workspaceId: string): Promise<ProjectKpi[]> {
    const rows = await prisma.projectKpi.findMany({
      where: { workspaceId },
      orderBy: { kpiKey: "asc" },
      include: {
        snapshots: { orderBy: { capturedAt: "asc" }, take: 90 },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      kpiKey: r.kpiKey,
      enabled: r.enabled,
      target: r.target,
      alertThreshold: r.alertThreshold,
      snapshots: r.snapshots.map((s) => ({
        value: s.value,
        capturedAt: s.capturedAt.toISOString(),
      })),
    }));
  }

  async set(workspaceId: string, entries: KpiConfigEntry[]): Promise<ProjectKpi[]> {
    await prisma.$transaction(async (tx) => {
      const keys = entries.map((e) => e.kpiKey);
      const existing = await tx.projectKpi.findMany({ where: { workspaceId } });
      const existingKeys = new Set(existing.map((e) => e.kpiKey));

      for (const entry of entries) {
        const payload = {
          enabled: entry.enabled,
          target: entry.target ?? null,
          alertThreshold: entry.alertThreshold ?? null,
        };
        if (existingKeys.has(entry.kpiKey)) {
          await tx.projectKpi.update({
            where: { workspaceId_kpiKey: { workspaceId, kpiKey: entry.kpiKey } },
            data: payload,
          });
        } else {
          await tx.projectKpi.create({
            data: { workspaceId, kpiKey: entry.kpiKey, ...payload },
          });
        }
      }
      // Disable KPIs no longer present (catalog shrink) but keep their snapshots.
      if (existingKeys.size > 0) {
        const toDisable = [...existingKeys].filter((k) => !keys.includes(k));
        if (toDisable.length) {
          await tx.projectKpi.updateMany({
            where: { workspaceId, kpiKey: { in: toDisable } },
            data: { enabled: false },
          });
        }
      }
    });
    return this.list(workspaceId);
  }

  async recordSnapshot(workspaceId: string, kpiKey: string, value: number): Promise<void> {
    const kpi = await prisma.projectKpi.findUnique({
      where: { workspaceId_kpiKey: { workspaceId, kpiKey } },
    });
    if (!kpi) return;
    await prisma.projectKpiSnapshot.create({
      data: { projectKpiId: kpi.id, value },
    });
  }
}

/* -------------------------------------------------------------------------- */
/* AI insights                                                                */
/* -------------------------------------------------------------------------- */

export class PrismaAiInsightRepository implements IAiInsightRepository {
  async list(workspaceId: string): Promise<ProjectAiInsight[]> {
    const rows = await prisma.projectAiInsight.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 60,
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
    await prisma.$transaction(async (tx) => {
      await tx.projectAiInsight.deleteMany({ where: { workspaceId } });
      if (insights.length > 0) {
        await tx.projectAiInsight.createMany({
          data: insights.map((i) => ({
            workspaceId,
            type: i.type,
            severity: i.severity,
            title: i.title,
            detail: i.detail,
          })),
        });
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
    await prisma.auditLog.create({
      data: {
        workspaceId: entry.workspaceId,
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        before: entry.before === undefined ? null : JSON.stringify(entry.before),
        after: entry.after === undefined ? null : JSON.stringify(entry.after),
      },
    });
  }
}
