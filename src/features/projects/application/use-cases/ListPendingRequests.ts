import { IProjectRepository } from "../../domain/repositories/IProjectRepository";
import { PendingRequestWithUser } from "../../domain/entities/JoinRequest";
import { UserFacingError } from "@/server/lib/errors";

export interface ListPendingRequestsInput {
  leaderUserId: string;
  workspaceId?: string;
}

export class ListPendingRequests {
  constructor(private readonly projectRepository: IProjectRepository) {}

  async execute(
    input: ListPendingRequestsInput
  ): Promise<PendingRequestWithUser[]> {
    const workspaceId = await this.resolveWorkspaceId(input);
    if (!workspaceId) return [];
    return this.projectRepository.listPendingRequests(workspaceId);
  }

  private async resolveWorkspaceId(
    input: ListPendingRequestsInput
  ): Promise<string | null> {
    if (input.workspaceId) {
      const isLeader = await this.projectRepository.isLeader(
        input.leaderUserId,
        input.workspaceId
      );
      if (!isLeader) {
        throw new UserFacingError(
          "Solo el líder del proyecto puede ver las solicitudes.",
          403
        );
      }
      return input.workspaceId;
    }

    // Fallback: first workspace where the user is leader/admin.
    const { prisma } = await import("@/server/lib/prisma");
    const membership = await prisma.membership.findFirst({
      where: {
        userId: input.leaderUserId,
        role: { in: ["leader", "admin"] },
      },
      orderBy: { joinedAt: "asc" },
      select: { workspaceId: true },
    });
    return membership?.workspaceId ?? null;
  }
}
