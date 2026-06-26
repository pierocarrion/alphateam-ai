import { prisma } from "@/server/lib/prisma";
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

export class PrismaProjectRepository implements IProjectRepository {
  async findByHashtag(hashtag: string): Promise<Project | null> {
    const row = await prisma.workspace.findUnique({
      where: { hashtag },
    });
    return row ? toProject(row) : null;
  }

  async findById(id: string): Promise<Project | null> {
    const row = await prisma.workspace.findUnique({ where: { id } });
    return row ? toProject(row) : null;
  }

  async search(query: string): Promise<ProjectSummary[]> {
    const q = query.trim().toLowerCase();
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { hashtag: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
            { industry: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

    const rows = await prisma.workspace.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        memberships: {
          where: { role: { in: ["leader", "admin"] } },
          include: { user: { select: { name: true } } },
          take: 1,
        },
        _count: { select: { memberships: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      hashtag: r.hashtag,
      emoji: r.emoji,
      description: r.description,
      industry: r.industry,
      category: r.category,
      memberCount: r._count.memberships,
      leaderName: r.memberships[0]?.user.name ?? null,
    }));
  }

  async listForUser(userId: string): Promise<ProjectSummary[]> {
    const rows = await prisma.workspace.findMany({
      where: { memberships: { some: { userId } } },
      orderBy: { createdAt: "asc" },
      include: {
        memberships: {
          where: { role: { in: ["leader", "admin"] } },
          include: { user: { select: { name: true } } },
          take: 1,
        },
        _count: { select: { memberships: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      hashtag: r.hashtag,
      emoji: r.emoji,
      description: r.description,
      industry: r.industry,
      category: r.category,
      memberCount: r._count.memberships,
      leaderName: r.memberships[0]?.user.name ?? null,
    }));
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

    const updated = await prisma.workspace.update({
      where: { id },
      data,
    });
    return toProject(updated);
  }

  async isMember(userId: string, workspaceId: string): Promise<boolean> {
    const m = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { id: true },
    });
    return !!m;
  }

  async isLeader(userId: string, workspaceId: string): Promise<boolean> {
    const m = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true },
    });
    return m?.role === "leader" || m?.role === "admin";
  }

  async hasOpenRequest(
    userId: string,
    workspaceId: string
  ): Promise<boolean> {
    const r = await prisma.joinRequest.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { status: true },
    });
    return r?.status === "pending";
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const kb: KnowledgeSeedItem[] = input.knowledgeBase.filter(
      (k) => k.title.trim().length > 0
    );

    const created = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: input.name,
          slug: input.slug,
          hashtag: input.hashtag,
          description: input.description ?? null,
          industry: input.industry ?? null,
          category: input.category ?? null,
          emoji: input.emoji ?? "🚀",
          teamSize: input.teamSize ?? null,
        },
      });

      await tx.membership.create({
        data: {
          userId: input.leaderUserId,
          workspaceId: workspace.id,
          role: "leader",
        },
      });

      await tx.workspaceSubscription.create({
        data: { workspaceId: workspace.id, plan: "free", status: "active" },
      });

      await tx.projectMethodology.create({
        data: {
          workspaceId: workspace.id,
          methodologyKey: input.methodology,
          tier: "primary",
        },
      });

      await tx.channel.create({
        data: {
          workspaceId: workspace.id,
          name: "general",
          type: "channel",
        },
      });

      if (kb.length > 0) {
        await tx.knowledgeBaseItem.createMany({
          data: kb.map((k) => ({
            workspaceId: workspace.id,
            title: k.title.trim(),
            content: k.content.trim(),
            sourceUrl: k.sourceUrl?.trim() || null,
          })),
        });
      }

      if (input.goal?.title?.trim()) {
        const goal = await tx.goal.create({
          data: {
            workspaceId: workspace.id,
            ownerId: input.leaderUserId,
            title: input.goal.title.trim(),
            status: "active",
          },
        });
        if (input.goal.milestone?.trim()) {
          await tx.milestone.create({
            data: {
              goalId: goal.id,
              title: input.goal.milestone.trim(),
              status: "pending",
            },
          });
        }
      }

      return workspace;
    });

    return toProject(created);
  }

  async createJoinRequest(input: RequestToJoinInput): Promise<JoinRequest> {
    const row = await prisma.joinRequest.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        message: input.message?.trim() || null,
        status: "pending",
      },
    });
    return toJoinRequest(row);
  }

  async findRequestByUser(
    userId: string,
    workspaceId: string
  ): Promise<JoinRequest | null> {
    const row = await prisma.joinRequest.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    return row ? toJoinRequest(row) : null;
  }

  async listPendingRequests(
    workspaceId: string
  ): Promise<PendingRequestWithUser[]> {
    const rows = await prisma.joinRequest.findMany({
      where: { workspaceId, status: "pending" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true, email: true } } },
    });
    return rows.map((r) => ({
      ...toJoinRequest(r),
      userName: r.user.name,
      userEmail: r.user.email,
    }));
  }

  async findRequest(id: string): Promise<JoinRequestWithUser | null> {
    const row = await prisma.joinRequest.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!row) return null;
    return {
      ...toJoinRequest(row),
      userName: row.user.name,
      userEmail: row.user.email,
    };
  }

  async decideRequest(
    id: string,
    decision: JoinRequestStatus,
    decidedById: string
  ): Promise<JoinRequest> {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.joinRequest.update({
        data: {
          status: decision,
          decidedById,
          decidedAt: new Date(),
        },
        where: { id },
      });

      if (decision === "approved") {
        await tx.membership.upsert({
          where: {
            userId_workspaceId: {
              userId: row.userId,
              workspaceId: row.workspaceId,
            },
          },
          create: {
            userId: row.userId,
            workspaceId: row.workspaceId,
            role: "member",
          },
          update: {},
        });
      }

      return row;
    });

    return toJoinRequest(updated);
  }

  async findOrCreateCommunity(): Promise<Project> {
    const existing = await prisma.workspace.findUnique({
      where: { hashtag: COMMUNITY_HASHTAG },
    });
    if (existing) return toProject(existing);

    const created = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: COMMUNITY_PROJECT.name,
          slug: COMMUNITY_PROJECT.slug,
          hashtag: COMMUNITY_PROJECT.hashtag,
          description: COMMUNITY_PROJECT.description,
          industry: COMMUNITY_PROJECT.industry,
          category: COMMUNITY_PROJECT.category,
          emoji: COMMUNITY_PROJECT.emoji,
        },
      });
      await tx.workspaceSubscription.create({
        data: { workspaceId: workspace.id, plan: "free", status: "active" },
      });
      await tx.channel.create({
        data: { workspaceId: workspace.id, name: "general", type: "channel" },
      });
      return workspace;
    });

    return toProject(created);
  }

  async addMember(workspaceId: string, userId: string): Promise<void> {
    await prisma.membership.upsert({
      where: { userId_workspaceId: { userId, workspaceId } },
      create: { workspaceId, userId, role: "member" },
      update: {},
    });
  }

  async listKnowledge(workspaceId: string): Promise<KnowledgeBaseItem[]> {
    const rows = await prisma.knowledgeBaseItem.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toKnowledgeBaseItem);
  }

  async addKnowledge(
    workspaceId: string,
    item: { title: string; content: string; sourceUrl?: string }
  ): Promise<KnowledgeBaseItem> {
    const row = await prisma.knowledgeBaseItem.create({
      data: {
        workspaceId,
        title: item.title.trim(),
        content: item.content.trim(),
        sourceUrl: item.sourceUrl?.trim() || null,
      },
    });
    return toKnowledgeBaseItem(row);
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
    const row = await prisma.knowledgeBaseItem.update({
      where: { id },
      data,
    });
    return toKnowledgeBaseItem(row);
  }

  async deleteKnowledge(id: string): Promise<void> {
    await prisma.knowledgeBaseItem.delete({ where: { id } });
  }
}
