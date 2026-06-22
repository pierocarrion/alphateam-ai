import { IProjectRepository } from "../../domain/repositories/IProjectRepository";
import { JoinRequest } from "../../domain/entities/JoinRequest";
import { UserFacingError } from "@/server/lib/errors";
import { normalizeHashtag } from "../../domain/hashtag";

export interface RequestToJoinInput {
  userId: string;
  hashtag: string;
  message?: string;
}

export class RequestToJoin {
  constructor(private readonly projectRepository: IProjectRepository) {}

  async execute(input: RequestToJoinInput): Promise<JoinRequest> {
    const hashtag = normalizeHashtag(input.hashtag);
    const project = await this.projectRepository.findByHashtag(hashtag);
    if (!project) {
      throw new UserFacingError(
        "No encontramos ese proyecto. Revisa el hashtag.",
        404
      );
    }

    const alreadyMember = await this.projectRepository.isMember(
      input.userId,
      project.id
    );
    if (alreadyMember) {
      throw new UserFacingError("Ya eres parte de este proyecto.", 409);
    }

    const hasOpen = await this.projectRepository.hasOpenRequest(
      input.userId,
      project.id
    );
    if (hasOpen) {
      throw new UserFacingError(
        "Ya enviaste una solicitud a este proyecto. Estamos esperando al líder.",
        409
      );
    }

    return this.projectRepository.createJoinRequest({
      workspaceId: project.id,
      userId: input.userId,
      message: input.message,
    });
  }
}
