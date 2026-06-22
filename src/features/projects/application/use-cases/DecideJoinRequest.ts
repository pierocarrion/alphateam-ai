import { z } from "zod";
import { IProjectRepository } from "../../domain/repositories/IProjectRepository";
import { JoinRequest, JoinRequestStatus } from "../../domain/entities/JoinRequest";
import { UserFacingError } from "@/server/lib/errors";

export const decideJoinRequestSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  decidedById: z.string().min(1),
});

export type DecideJoinRequestInput = z.infer<typeof decideJoinRequestSchema>;

export class DecideJoinRequest {
  constructor(private readonly projectRepository: IProjectRepository) {}

  async execute(input: DecideJoinRequestInput): Promise<JoinRequest> {
    const request = await this.projectRepository.findRequest(input.requestId);
    if (!request) {
      throw new UserFacingError(
        "No encontramos esa solicitud. Puede que ya haya sido atendida.",
        404
      );
    }

    if (request.status !== "pending") {
      throw new UserFacingError(
        "Esta solicitud ya fue respondida.",
        409
      );
    }

    const isLeader = await this.projectRepository.isLeader(
      input.decidedById,
      request.workspaceId
    );
    if (!isLeader) {
      throw new UserFacingError(
        "Solo el líder del proyecto puede responder solicitudes.",
        403
      );
    }

    const decision: JoinRequestStatus =
      input.decision === "approved" ? "approved" : "rejected";
    return this.projectRepository.decideRequest(
      input.requestId,
      decision,
      input.decidedById
    );
  }
}
