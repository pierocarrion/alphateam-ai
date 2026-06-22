import { IUserRepository } from "@/features/auth/domain/repositories/IUserRepository";
import { PrismaUserRepository } from "@/features/auth/infrastructure/repositories/PrismaUserRepository";
import { IProjectRepository } from "@/features/projects/domain/repositories/IProjectRepository";
import { PrismaProjectRepository } from "@/features/projects/infrastructure/repositories/PrismaProjectRepository";

export interface Container {
  userRepository: IUserRepository;
  projectRepository: IProjectRepository;
}

export function createContainer(): Container {
  return {
    userRepository: new PrismaUserRepository(),
    projectRepository: new PrismaProjectRepository(),
  };
}

export const container = createContainer();
