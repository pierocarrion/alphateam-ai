import { z } from "zod";
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { UserProfile } from "../../domain/entities/User";

export const completeOnboardingSchema = z.object({
  userId: z.string(),
  role: z.string().min(1),
  hardMoment: z.string().min(1),
  profileId: z.string().min(1),
  tone: z.enum(["warm", "balanced"]).default("warm"),
  jobTitle: z.string().optional(),
  seniority: z.string().optional(),
  headline: z.string().optional(),
  skills: z.array(z.string()).optional(),
  cvStorageKey: z.string().optional(),
});

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;

export class CompleteOnboarding {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: CompleteOnboardingInput): Promise<UserProfile> {
    return this.userRepository.updateProfile(input.userId, {
      role: input.role,
      hardMoment: input.hardMoment,
      profileId: input.profileId,
      onboarded: true,
      tone: input.tone,
      jobTitle: input.jobTitle,
      seniority: input.seniority,
      headline: input.headline,
      skills: input.skills,
      cvStorageKey: input.cvStorageKey,
    });
  }
}
