import { prisma } from "@/server/lib/prisma";
import {
  CreateProjectInput,
  IProjectRepository,
  KnowledgeSeedItem,
  RequestToJoinInput,
} from "../../domain/repositories/IProjectRepository";
import { Project, ProjectSummary } from "../../domain/entities/Project";
import {
  JoinRequest,
  JoinRequestStatus,
  JoinRequestWithUser,
  PendingRequestWithUser,
} from "../../domain/entities/JoinRequest";

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
}
