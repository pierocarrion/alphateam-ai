import { describe, expect, it } from "vitest";
import {
  CompleteOnboarding,
  completeOnboardingSchema,
} from "./CompleteOnboarding";
import { PrismaUserRepository } from "../../infrastructure/repositories/PrismaUserRepository";
import { seedUser, getTestDb } from "@/tests/helpers/db";
import { userProfile } from "@drizzle/schema";
import { eq } from "drizzle-orm";

const createUseCase = () => new CompleteOnboarding(new PrismaUserRepository());

describe("CompleteOnboarding", () => {
  it("completes a user profile", async () => {
    const useCase = createUseCase();
    const { user } = await seedUser();

    const profile = await useCase.execute({
      userId: user.id,
      role: "Designer",
      hardMoment: "Afternoons",
      profileId: "multi",
      tone: "balanced",
    });

    expect(profile.onboarded).toBe(true);
    expect(profile.role).toBe("Designer");
    expect(profile.hardMoment).toBe("Afternoons");
    expect(profile.profileId).toBe("multi");
    expect(profile.tone).toBe("balanced");

    const db = await getTestDb();
    const row = await db.query.userProfile.findFirst({
      where: eq(userProfile.userId, user.id),
    });
    expect(row?.onboarded).toBe(true);
  });

  it("defaults tone to warm", async () => {
    const useCase = createUseCase();
    const { user } = await seedUser();

    const profile = await useCase.execute({
      userId: user.id,
      role: "Engineer",
      hardMoment: "Mornings",
      profileId: "rbp",
    });

    expect(profile.tone).toBe("warm");
  });

  it("schema requires role, hardMoment and profileId", () => {
    const result = completeOnboardingSchema.safeParse({
      userId: "user-id",
    });
    expect(result.success).toBe(false);
  });
});
