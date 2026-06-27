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
    const { db } = await import("@/server/lib/db");
    const { membership } = await import("@drizzle/schema");
    const { eq, asc, inArray } = await import("drizzle-orm");
    const m = await db
      .select({ workspaceId: membership.workspaceId })
      .from(membership)
      .where(
        eq(membership.userId, input.leaderUserId) &&
          inArray(membership.role, ["leader", "admin"])
      )
      .orderBy(asc(membership.joinedAt))
      .limit(1);
    return m[0]?.workspaceId ?? null;
  }
}
