import { describe, expect, it, beforeEach } from "vitest";
import { POST } from "./route";
import { seedUser, resetDatabase, getTestPrisma } from "@/tests/helpers/db";
import { mockSession } from "@/tests/helpers/auth";

describe("POST /api/projects/join-community", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns 401 when not authenticated", async () => {
    const response = await POST();
    expect(response.status).toBe(401);
  });

  it("lazily creates the community workspace and adds the user as a member", async () => {
    const { user } = await seedUser({ name: "Nuevo" });
    await mockSession(user);

    const prisma = await getTestPrisma();
    const before = await prisma.workspace.count();
    expect(before).toBe(0);

    const response = await POST();
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.workspace.hashtag).toBe("#comunidad");

    // Workspace + general channel + subscription created once.
    const after = await prisma.workspace.count();
    expect(after).toBe(1);
    const channels = await prisma.channel.findMany({
      where: { workspaceId: data.workspace.id },
    });
    expect(channels.some((c) => c.name === "general")).toBe(true);

    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: data.workspace.id,
        },
      },
    });
    expect(membership?.role).toBe("member");
  });

  it("reuses the same community workspace for a second joiner", async () => {
    const { user: a } = await seedUser({ name: "A", email: "a@example.com" });
    const { user: b } = await seedUser({ name: "B", email: "b@example.com" });

    await mockSession(a);
    const first = await POST();
    const firstData = await first.json();

    await mockSession(b);
    const second = await POST();
    const secondData = await second.json();

    expect(secondData.workspace.id).toBe(firstData.workspace.id);

    const prisma = await getTestPrisma();
    const count = await prisma.workspace.count();
    expect(count).toBe(1);
    const members = await prisma.membership.count({
      where: { workspaceId: firstData.workspace.id },
    });
    expect(members).toBe(2);
  });
});
