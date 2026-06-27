import { describe, expect, it, beforeEach } from "vitest";
import { POST } from "./route";
import { seedUser, resetDatabase, getTestDb } from "@/tests/helpers/db";
import { mockSession } from "@/tests/helpers/auth";
import { createJsonRequest } from "@/tests/helpers/fetch";
import { CreateProject } from "@/features/projects/application/use-cases/CreateProject";
import { PrismaProjectRepository } from "@/features/projects/infrastructure/repositories/PrismaProjectRepository";
import { membership as membershipTable } from "@drizzle/schema";
import { and, eq } from "drizzle-orm";

const createProject = new CreateProject(new PrismaProjectRepository());

async function seedLeaderProject(leaderEmail: string, hashtag: string) {
  const { user } = await seedUser({ name: "Leader", email: leaderEmail });
  await mockSession(user);
  const project = await createProject.execute({
    userId: user.id,
    name: "Plataforma",
    hashtag,
  });
  return { user, project };
}

describe("POST /api/projects", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns 401 when not authenticated", async () => {
    const request = createJsonRequest(
      "http://localhost:3000/api/projects",
      "POST",
      { name: "X", hashtag: "#x" }
    );
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("creates a project for an authenticated leader", async () => {
    const { user } = await seedUser({ name: "New Leader" });
    await mockSession(user);

    const request = createJsonRequest(
      "http://localhost:3000/api/projects",
      "POST",
      {
        name: "Q3 Launch",
        hashtag: "#q3-launch",
        emoji: "🚀",
        knowledgeBase: [{ title: "Brief", content: "el brief" }],
      }
    );

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.project.hashtag).toBe("#q3-launch");

    const db = await getTestDb();
    const membership = await db.query.membership.findFirst({
      where: and(
        eq(membershipTable.userId, user.id),
        eq(membershipTable.workspaceId, data.project.id)
      ),
    });
    expect(membership?.role).toBe("leader");
  });

  it("rejects an invalid hashtag", async () => {
    const { user } = await seedUser({ name: "New Leader" });
    await mockSession(user);

    const request = createJsonRequest(
      "http://localhost:3000/api/projects",
      "POST",
      { name: "Bad", hashtag: "#n" }
    );
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("rejects a duplicate hashtag with 409", async () => {
    await seedLeaderProject("leader-a@example.com", "#taken");

    const { user: leaderB } = await seedUser({
      name: "Leader B",
      email: "leader-b@example.com",
    });
    await mockSession(leaderB);

    const request = createJsonRequest(
      "http://localhost:3000/api/projects",
      "POST",
      { name: "Other", hashtag: "#taken" }
    );
    const response = await POST(request);
    expect(response.status).toBe(409);
  });
});
