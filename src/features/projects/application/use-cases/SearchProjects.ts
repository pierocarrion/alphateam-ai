import { IProjectRepository } from "../../domain/repositories/IProjectRepository";
import { ProjectSummary } from "../../domain/entities/Project";

export class SearchProjects {
  constructor(private readonly projectRepository: IProjectRepository) {}

  execute(query: string): Promise<ProjectSummary[]> {
    return this.projectRepository.search(query);
  }
}
