import { IProjectRepository } from "../../domain/repositories/IProjectRepository";
import { Project } from "../../domain/entities/Project";

export class JoinCommunity {
  constructor(private readonly projectRepository: IProjectRepository) {}

  async execute(userId: string): Promise<Project> {
    const workspace = await this.projectRepository.findOrCreateCommunity();
    await this.projectRepository.addMember(workspace.id, userId);
    return workspace;
  }
}
