import { db } from "@/server/lib/db";
import {
  workspace,
  membership,
  channel,
  workspaceSubscription,
  projectMethodology,
  projectPhaseState,
  knowledgeBaseItem,
  joinRequest,
  goal,
  milestone,
  user,
} from "@drizzle/schema";
import { eq, and, or, desc, asc, inArray, ilike, count } from "drizzle-orm";
import {
  CreateProjectInput,
  IProjectRepository,
  KnowledgeBaseItem,
  KnowledgeSeedItem,
  RequestToJoinInput,
  UpdateProjectInput,
} from "../../domain/repositories/IProjectRepository";
import { Project, ProjectSummary } from "../../domain/entities/Project";
import {
  JoinRequest,
  JoinRequestStatus,
  JoinRequestWithUser,
  PendingRequestWithUser,
} from "../../domain/entities/JoinRequest";
import {
  COMMUNITY_HASHTAG,
  COMMUNITY_PROJECT,
} from "../../domain/community";
import {
  getMethodologyPhases,
} from "@/features/project-phases/domain/visualization";

function toProject(row: {
  id: string;
  name: string;
  slug: string;
  hashtag: string;
  description: string | null;
  industry: string | null;
  category: string | null;
  emoji: string | null;
  teamSize: string | null;
  createdAt: Date;
}): Project {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    hashtag: row.hashtag,
    description: row.description,
    industry: row.industry,
    category: row.category,
    emoji: row.emoji,
    teamSize: row.teamSize,
    createdAt: row.createdAt,
  };
}

function toKnowledgeBaseItem(row: {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  sourceApp: string | null;
  sourceUrl: string | null;
  validatedByLlmAt: Date | null;
  createdAt: Date;
}): KnowledgeBaseItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    content: row.content,
    sourceApp: row.sourceApp,
    sourceUrl: row.sourceUrl,
    createdAt: row.createdAt,
  };
}

function toJoinRequest(row: {
  id: string;
  workspaceId: string;
  userId: string;
  message: string | null;
  status: string;
  decidedById: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}): JoinRequest {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    message: row.message,
    status: (["pending", "approved", "rejected"].includes(row.status)
      ? row.status
      : "pending") as JoinRequestStatus,
    decidedById: row.decidedById,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
  };
}

async function buildSummaries(
  wsRows: {
    id: string;
    name: string;
    hashtag: string;
    emoji: string | null;
    description: string | null;
    industry: string | null;
    category: string | null;
  }[]
): Promise<ProjectSummary[]> {
  const ids = wsRows.map((w) => w.id);
  if (ids.length === 0) return [];

  const [countRows, leaderRows] = await Promise.all([
    db
      .select({
        workspaceId: membership.workspaceId,
        memberCount: count(),
      })
      .from(membership)
      .where(inArray(membership.workspaceId, ids))
      .groupBy(membership.workspaceId),
    db
      .select({
        workspaceId: membership.workspaceId,
        name: user.name,
      })
      .from(membership)
      .leftJoin(user, eq(user.id, membership.userId))
      .where(
        and(
          inArray(membership.workspaceId, ids),
          inArray(membership.role, ["leader", "admin"])
        )
      ),
  ]);

  const countMap = new Map<string, number>();
  for (const c of countRows) countMap.set(c.workspaceId, Number(c.memberCount));

  const leaderMap = new Map<string, string | null>();
  for (const l of leaderRows) {
    if (!leaderMap.has(l.workspaceId)) {
      leaderMap.set(l.workspaceId, l.name ?? null);
    }
  }

  return wsRows.map((r) => ({
    id: r.id,
    name: r.name,
    hashtag: r.hashtag,
    emoji: r.emoji,
    description: r.description,
    industry: r.industry,
    category: r.category,
    memberCount: countMap.get(r.id) ?? 0,
    leaderName: leaderMap.get(r.id) ?? null,
  }));
}

export class PrismaProjectRepository implements IProjectRepository {
  async findByHashtag(hashtag: string): Promise<Project | null> {
    const row = await db.query.workspace.findFirst({
      where: eq(workspace.hashtag, hashtag),
    });
    return row ? toProject(row) : null;
  }

  async findById(id: string): Promise<Project | null> {
    const row = await db.query.workspace.findFirst({
      where: eq(workspace.id, id),
    });
    return row ? toProject(row) : null;
  }

  async search(query: string): Promise<ProjectSummary[]> {
    const q = query.trim().toLowerCase();
    const where = q
      ? or(
          ilike(workspace.name, `%${q}%`),
          ilike(workspace.hashtag, `%${q}%`),
          ilike(workspace.description, `%${q}%`),
          ilike(workspace.industry, `%${q}%`)
        )
      : undefined;

    const wsRows = await db
      .select({
        id: workspace.id,
        name: workspace.name,
        hashtag: workspace.hashtag,
        emoji: workspace.emoji,
        description: workspace.description,
        industry: workspace.industry,
        category: workspace.category,
      })
      .from(workspace)
      .where(where)
      .orderBy(desc(workspace.createdAt))
      .limit(25);

    return buildSummaries(wsRows);
  }

  async listForUser(userId: string): Promise<ProjectSummary[]> {
    const wsRows = await db
      .select({
        id: workspace.id,
        name: workspace.name,
        hashtag: workspace.hashtag,
        emoji: workspace.emoji,
        description: workspace.description,
        industry: workspace.industry,
        category: workspace.category,
      })
      .from(membership)
      .innerJoin(workspace, eq(workspace.id, membership.workspaceId))
      .where(eq(membership.userId, userId))
      .orderBy(asc(workspace.createdAt));

    const seen = new Set<string>();
    const deduped = wsRows.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    return buildSummaries(deduped);
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const data: Record<string, unknown> = {};
    if (typeof input.name === "string") data.name = input.name.trim();
    if (input.description !== undefined)
      data.description = input.description?.trim() || null;
    if (input.industry !== undefined) data.industry = input.industry || null;
    if (input.category !== undefined) data.category = input.category || null;
    if (input.teamSize !== undefined) data.teamSize = input.teamSize || null;
    if (typeof input.emoji === "string") data.emoji = input.emoji;

    const [updated] = await db
      .update(workspace)
      .set(data)
      .where(eq(workspace.id, id))
      .returning();
    return toProject(updated!);
  }

  async isMember(userId: string, workspaceId: string): Promise<boolean> {
    const rows = await db
      .select({ id: membership.id })
      .from(membership)
      .where(
        and(
          eq(membership.userId, userId),
          eq(membership.workspaceId, workspaceId)
        )
      )
      .limit(1);
    return rows.length > 0;
  }

  async isLeader(userId: string, workspaceId: string): Promise<boolean> {
    const rows = await db
      .select({ role: membership.role })
      .from(membership)
      .where(
        and(
          eq(membership.userId, userId),
          eq(membership.workspaceId, workspaceId)
        )
      )
      .limit(1);
    const role = rows[0]?.role;
    return role === "leader" || role === "admin";
  }

  async hasOpenRequest(
    userId: string,
    workspaceId: string
  ): Promise<boolean> {
    const rows = await db
      .select({ status: joinRequest.status })
      .from(joinRequest)
      .where(
        and(
          eq(joinRequest.workspaceId, workspaceId),
          eq(joinRequest.userId, userId)
        )
      )
      .limit(1);
    return rows[0]?.status === "pending";
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const kb: KnowledgeSeedItem[] = input.knowledgeBase.filter(
      (k) => k.title.trim().length > 0
    );

    const created = await db.transaction(async (tx) => {
      const [workspaceRow] = await tx
        .insert(workspace)
        .values({
          name: input.name,
          slug: input.slug,
          hashtag: input.hashtag,
          description: input.description ?? null,
          industry: input.industry ?? null,
          category: input.category ?? null,
          emoji: input.emoji ?? "🚀",
          teamSize: input.teamSize ?? null,
        })
        .returning();

      await tx.insert(membership).values({
        userId: input.leaderUserId,
        workspaceId: workspaceRow!.id,
        role: "leader",
      });

      await tx.insert(workspaceSubscription).values({
        workspaceId: workspaceRow!.id,
        plan: "free",
        status: "active",
      });

      await tx.insert(projectMethodology).values({
        workspaceId: workspaceRow!.id,
        methodologyKey: input.methodology,
        tier: "primary",
      });

      const phases = getMethodologyPhases(input.methodology);
      if (phases.length > 0) {
        await tx
          .insert(projectPhaseState)
          .values(
            phases.map((p) => ({
              workspaceId: workspaceRow!.id,
              methodologyKey: input.methodology,
              phaseKey: p.phaseKey,
              status: "not_started" as const,
            }))
          )
          .onConflictDoNothing();
      }

      await tx.insert(channel).values({
        workspaceId: workspaceRow!.id,
        name: "general",
        type: "channel",
      });

      if (kb.length > 0) {
        await tx.insert(knowledgeBaseItem).values(
          kb.map((k) => ({
            workspaceId: workspaceRow!.id,
            title: k.title.trim(),
            content: k.content.trim(),
            sourceUrl: k.sourceUrl?.trim() || null,
          }))
        );
      }

      if (input.goal?.title?.trim()) {
        const [goalRow] = await tx
          .insert(goal)
          .values({
            workspaceId: workspaceRow!.id,
            ownerId: input.leaderUserId,
            title: input.goal.title.trim(),
            status: "active",
          })
          .returning();
        if (input.goal.milestone?.trim()) {
          await tx.insert(milestone).values({
            goalId: goalRow!.id,
            title: input.goal.milestone.trim(),
            status: "pending",
          });
        }
      }

      return workspaceRow!;
    });

    return toProject(created);
  }

  async createJoinRequest(input: RequestToJoinInput): Promise<JoinRequest> {
    const [row] = await db
      .insert(joinRequest)
      .values({
        workspaceId: input.workspaceId,
        userId: input.userId,
        message: input.message?.trim() || null,
        status: "pending",
      })
      .returning();
    return toJoinRequest(row!);
  }

  async findRequestByUser(
    userId: string,
    workspaceId: string
  ): Promise<JoinRequest | null> {
    const rows = await db
      .select()
      .from(joinRequest)
      .where(
        and(
          eq(joinRequest.workspaceId, workspaceId),
          eq(joinRequest.userId, userId)
        )
      )
      .limit(1);
    return rows[0] ? toJoinRequest(rows[0]) : null;
  }

  async listPendingRequests(
    workspaceId: string
  ): Promise<PendingRequestWithUser[]> {
    const rows = await db
      .select({
        id: joinRequest.id,
        workspaceId: joinRequest.workspaceId,
        userId: joinRequest.userId,
        message: joinRequest.message,
        status: joinRequest.status,
        decidedById: joinRequest.decidedById,
        decidedAt: joinRequest.decidedAt,
        createdAt: joinRequest.createdAt,
        userName: user.name,
        userEmail: user.email,
      })
      .from(joinRequest)
      .leftJoin(user, eq(user.id, joinRequest.userId))
      .where(
        and(
          eq(joinRequest.workspaceId, workspaceId),
          eq(joinRequest.status, "pending")
        )
      )
      .orderBy(asc(joinRequest.createdAt));
    return rows.map((r) => ({
      ...toJoinRequest(r),
      userName: r.userName,
      userEmail: r.userEmail,
    }));
  }

  async findRequest(id: string): Promise<JoinRequestWithUser | null> {
    const rows = await db
      .select({
        id: joinRequest.id,
        workspaceId: joinRequest.workspaceId,
        userId: joinRequest.userId,
        message: joinRequest.message,
        status: joinRequest.status,
        decidedById: joinRequest.decidedById,
        decidedAt: joinRequest.decidedAt,
        createdAt: joinRequest.createdAt,
        userName: user.name,
        userEmail: user.email,
      })
      .from(joinRequest)
      .leftJoin(user, eq(user.id, joinRequest.userId))
      .where(eq(joinRequest.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      ...toJoinRequest(row),
      userName: row.userName,
      userEmail: row.userEmail,
    };
  }

  async decideRequest(
    id: string,
    decision: JoinRequestStatus,
    decidedById: string
  ): Promise<JoinRequest> {
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(joinRequest)
        .set({
          status: decision,
          decidedById,
          decidedAt: new Date(),
        })
        .where(eq(joinRequest.id, id))
        .returning();

      if (decision === "approved" && row) {
        await tx
          .insert(membership)
          .values({
            userId: row.userId,
            workspaceId: row.workspaceId,
            role: "member",
          })
          .onConflictDoNothing();
      }

      return row!;
    });

    return toJoinRequest(updated);
  }

  async findOrCreateCommunity(): Promise<Project> {
    const existing = await db.query.workspace.findFirst({
      where: eq(workspace.hashtag, COMMUNITY_HASHTAG),
    });
    if (existing) return toProject(existing);

    const created = await db.transaction(async (tx) => {
      const [workspaceRow] = await tx
        .insert(workspace)
        .values({
          name: COMMUNITY_PROJECT.name,
          slug: COMMUNITY_PROJECT.slug,
          hashtag: COMMUNITY_PROJECT.hashtag,
          description: COMMUNITY_PROJECT.description,
          industry: COMMUNITY_PROJECT.industry,
          category: COMMUNITY_PROJECT.category,
          emoji: COMMUNITY_PROJECT.emoji,
        })
        .returning();
      await tx.insert(workspaceSubscription).values({
        workspaceId: workspaceRow!.id,
        plan: "free",
        status: "active",
      });
      await tx.insert(channel).values({
        workspaceId: workspaceRow!.id,
        name: "general",
        type: "channel",
      });
      return workspaceRow!;
    });

    return toProject(created);
  }

  async addMember(workspaceId: string, userId: string): Promise<void> {
    await db
      .insert(membership)
      .values({ workspaceId, userId, role: "member" })
      .onConflictDoNothing();
  }

  async listKnowledge(workspaceId: string): Promise<KnowledgeBaseItem[]> {
    const rows = await db
      .select()
      .from(knowledgeBaseItem)
      .where(eq(knowledgeBaseItem.workspaceId, workspaceId))
      .orderBy(asc(knowledgeBaseItem.createdAt));
    return rows.map(toKnowledgeBaseItem);
  }

  async addKnowledge(
    workspaceId: string,
    item: { title: string; content: string; sourceUrl?: string }
  ): Promise<KnowledgeBaseItem> {
    const [row] = await db
      .insert(knowledgeBaseItem)
      .values({
        workspaceId,
        title: item.title.trim(),
        content: item.content.trim(),
        sourceUrl: item.sourceUrl?.trim() || null,
      })
      .returning();
    return toKnowledgeBaseItem(row!);
  }

  async updateKnowledge(
    id: string,
    patch: {
      title?: string;
      content?: string;
      sourceUrl?: string | null;
    }
  ): Promise<KnowledgeBaseItem> {
    const data: Record<string, unknown> = {};
    if (typeof patch.title === "string") data.title = patch.title.trim();
    if (typeof patch.content === "string") data.content = patch.content.trim();
    if (patch.sourceUrl !== undefined) {
      data.sourceUrl = patch.sourceUrl?.trim() || null;
    }
    const [row] = await db
      .update(knowledgeBaseItem)
      .set(data)
      .where(eq(knowledgeBaseItem.id, id))
      .returning();
    return toKnowledgeBaseItem(row!);
  }

  async deleteKnowledge(id: string): Promise<void> {
    await db.delete(knowledgeBaseItem).where(eq(knowledgeBaseItem.id, id));
  }
}
