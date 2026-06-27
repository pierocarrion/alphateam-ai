import { describe, expect, it } from "vitest";
import { CreateProject, createProjectSchema } from "./CreateProject";
import { PrismaProjectRepository } from "../../infrastructure/repositories/PrismaProjectRepository";
import { PrismaUserRepository } from "@/features/auth/infrastructure/repositories/PrismaUserRepository";
import { getTestDb } from "@/tests/helpers/db";
import { UserFacingError } from "@/server/lib/errors";
import { resetDatabase, seedUser } from "@/tests/helpers/db";
import { eq, and } from "drizzle-orm";
import {
  membership as membershipTable,
  channel,
  knowledgeBaseItem,
  goal as goalTable,
} from "@drizzle/schema";

const repo = new PrismaProjectRepository();
const userRepo = new PrismaUserRepository();
const useCase = new CreateProject(repo);

async function seedLeader() {
  return seedUser({ name: "Leader", onboarded: true });
}

describe("CreateProject", () => {
  it("creates a project with leader membership, channel and subscription", async () => {
    await resetDatabase();
    const { user } = await seedLeader();

    const project = await useCase.execute({
      userId: user.id,
      name: "Q3 Launch",
      hashtag: "#q3-launch",
      emoji: "🚀",
      description: "Lanzamiento del trimestre",
      industry: "Tecnología",
      category: "Lanzamiento",
      knowledgeBase: [{ title: "Brief", content: "El brief del proyecto" }],
      goal: { title: "Primer hito", milestone: "Plan listo" },
    });

    expect(project.hashtag).toBe("#q3-launch");
    expect(project.slug).toBe("q3-launch");

    const db = await getTestDb();
    const membership = await db.query.membership.findFirst({
      where: and(
        eq(membershipTable.userId, user.id),
        eq(membershipTable.workspaceId, project.id)
      ),
    });
    expect(membership?.role).toBe("leader");

    const channels = await db.query.channel.findMany({
      where: eq(channel.workspaceId, project.id),
    });
    expect(channels.some((c) => c.name === "general")).toBe(true);

    const kb = await db.query.knowledgeBaseItem.findMany({
      where: eq(knowledgeBaseItem.workspaceId, project.id),
    });
    expect(kb).toHaveLength(1);
    expect(kb[0].title).toBe("Brief");

    const goal = await db.query.goal.findFirst({
      where: eq(goalTable.workspaceId, project.id),
    });
    expect(goal?.title).toBe("Primer hito");
  });

  it("rejects an invalid hashtag", async () => {
    await resetDatabase();
    const { user } = await seedLeader();

    await expect(
      useCase.execute({
        userId: user.id,
        name: "Bad",
        hashtag: "#a",
      })
    ).rejects.toBeInstanceOf(UserFacingError);
  });

  it("rejects a duplicate hashtag", async () => {
    await resetDatabase();
    const { user } = await seedLeader();

    await useCase.execute({
      userId: user.id,
      name: "First",
      hashtag: "#dup",
    });

    const { user: user2 } = await seedUser({
      name: "Leader2",
      email: "leader2@example.com",
    });

    await expect(
      useCase.execute({
        userId: user2.id,
        name: "Second",
        hashtag: "#dup",
      })
    ).rejects.toThrow(/ya está en uso/i);
  });

  it("normalizes a hashtag without the leading #", async () => {
    await resetDatabase();
    const { user } = await seedLeader();

    const project = await useCase.execute({
      userId: user.id,
      name: "Auto",
      hashtag: "Auto-Tag",
    });
    expect(project.hashtag).toBe("#auto-tag");
  });

  it("schema requires a name of at least 2 chars", () => {
    const result = createProjectSchema.safeParse({
      userId: "u1",
      name: "x",
      hashtag: "#x",
    });
    expect(result.success).toBe(false);
  });

  it("user repository still finds the leader", async () => {
    await resetDatabase();
    const { user } = await seedLeader();
    const found = await userRepo.findById(user.id);
    expect(found?.id).toBe(user.id);
  });
});
