import { z } from "zod";
import { IProjectRepository } from "../../domain/repositories/IProjectRepository";
import { Project } from "../../domain/entities/Project";
import { UserFacingError } from "@/server/lib/errors";
import { hashtagToSlug, isValidHashtag, normalizeHashtag } from "../../domain/hashtag";

export const knowledgeSeedSchema = z
  .object({
    title: z.string().min(1),
    content: z.string().default(""),
    sourceUrl: z.string().optional(),
  })
  .optional();

export const createProjectSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(2).max(60),
  hashtag: z.string().min(1),
  description: z.string().max(600).optional(),
  industry: z.string().max(40).optional(),
  category: z.string().max(40).optional(),
  emoji: z.string().max(8).optional(),
  teamSize: z.string().max(20).optional(),
  tone: z.enum(["warm", "balanced"]).optional(),
  methodology: z.enum(["scrum", "design_thinking"]).default("design_thinking"),
  knowledgeBase: z
    .array(
      z.object({
        title: z.string().min(1),
        content: z.string().default(""),
        sourceUrl: z.string().optional(),
      })
    )
    .default([]),
  goal: z
    .object({
      title: z.string().min(1),
      milestone: z.string().optional(),
    })
    .nullable()
    .default(null),
});

export type CreateProjectUseCaseInput = z.infer<typeof createProjectSchema>;

export class CreateProject {
  constructor(private readonly projectRepository: IProjectRepository) {}

  async execute(input: CreateProjectUseCaseInput): Promise<Project> {
    const hashtag = normalizeHashtag(input.hashtag);
    if (!isValidHashtag(hashtag)) {
      throw new UserFacingError(
        "El hashtag debe empezar con #, usar minúsculas y guiones. Ej: #q3-launch",
        400
      );
    }

    const name = input.name.trim();
    if (name.length < 2) {
      throw new UserFacingError("Tu proyecto necesita un nombre.", 400);
    }

    const slug = hashtagToSlug(hashtag);
    const existing = await this.projectRepository.findByHashtag(hashtag);
    if (existing) {
      throw new UserFacingError(
        `El hashtag ${hashtag} ya está en uso. Prueba con otro.`,
        409
      );
    }

    return this.projectRepository.create({
      name,
      slug,
      hashtag,
      description: input.description?.trim() || undefined,
      industry: input.industry?.trim() || undefined,
      category: input.category?.trim() || undefined,
      emoji: input.emoji?.trim() || undefined,
      teamSize: input.teamSize?.trim() || undefined,
      leaderUserId: input.userId,
      methodology: input.methodology ?? "design_thinking",
      knowledgeBase: (input.knowledgeBase ?? []).map((k) => ({
        title: k.title,
        content: k.content || k.title,
        sourceUrl: k.sourceUrl,
      })),
      goal: input.goal?.title
        ? {
            title: input.goal.title,
            milestone: input.goal.milestone,
          }
        : null,
    });
  }
}
