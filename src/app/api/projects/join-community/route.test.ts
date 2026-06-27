import { describe, expect, it, beforeEach } from "vitest";
import { POST } from "./route";
import { seedUser, resetDatabase, getTestDb } from "@/tests/helpers/db";
import { mockSession } from "@/tests/helpers/auth";
import {
  workspace as workspaceTable,
  channel as channelTable,
  membership as membershipTable,
} from "@drizzle/schema";
import { eq, and, count } from "drizzle-orm";

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

    const db = await getTestDb();
    const [{ before }] = await db.select({ before: count() }).from(workspaceTable);
    expect(Number(before)).toBe(0);

    const response = await POST();
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.workspace.hashtag).toBe("#comunidad");

    // Workspace + general channel + subscription created once.
    const [{ after }] = await db.select({ after: count() }).from(workspaceTable);
    expect(Number(after)).toBe(1);
    const channels = await db.query.channel.findMany({
      where: eq(channelTable.workspaceId, data.workspace.id),
    });
    expect(channels.some((c) => c.name === "general")).toBe(true);

    const membership = await db.query.membership.findFirst({
      where: and(
        eq(membershipTable.userId, user.id),
        eq(membershipTable.workspaceId, data.workspace.id),
      ),
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

    const db = await getTestDb();
    const [{ c }] = await db.select({ c: count() }).from(workspaceTable);
    expect(Number(c)).toBe(1);
    const [{ members }] = await db
      .select({ members: count() })
      .from(membershipTable)
      .where(eq(membershipTable.workspaceId, firstData.workspace.id));
    expect(Number(members)).toBe(2);
  });
});
