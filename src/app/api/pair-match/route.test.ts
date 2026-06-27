import { afterEach, describe, expect, it, vi } from "vitest";
import { getServerSession } from "next-auth/next";
import { POST, GET } from "./route";
import { seedMember, getTestDb } from "@/tests/helpers/db";
import { mockSession } from "@/tests/helpers/auth";
import { createJsonRequest, callRouteHandler } from "@/tests/helpers/fetch";
import { task as taskTable, pairMatch as pairMatchTable } from "@drizzle/schema";
import { eq } from "drizzle-orm";

const URL = "http://localhost:3000/api/pair-match";

afterEach(() => {
  vi.mocked(getServerSession).mockReset();
});

describe("POST /api/pair-match", () => {
  it("requires auth", async () => {
    const response = await callRouteHandler(
      POST,
      createJsonRequest(URL, "POST", { partnerId: "anyone" })
    );
    expect(response.status).toBe(401);
  });

  it("rejects an invalid body (missing partnerId)", async () => {
    const { user } = await seedMember();
    await mockSession(user);

    const response = await callRouteHandler(
      POST,
      createJsonRequest(URL, "POST", {})
    );
    expect(response.status).toBe(400);
  });

  it("rejects pairing with yourself", async () => {
    const { user } = await seedMember();
    await mockSession(user);

    const response = await callRouteHandler(
      POST,
      createJsonRequest(URL, "POST", { partnerId: user.id })
    );
    expect(response.status).toBe(400);
  });

  it("rejects when the partner is not in your workspace", async () => {
    const requester = await seedMember();
    await mockSession(requester.user);
    const { user: outsider } = await seedMember();

    const response = await callRouteHandler(
      POST,
      createJsonRequest(URL, "POST", { partnerId: outsider.id })
    );
    expect(response.status).toBe(404);
  });

  it("creates a pending pair match with a workspace member", async () => {
    const requester = await seedMember();
    const partner = await seedMember({ workspaceId: requester.workspaceId });
    await mockSession(requester.user);

    const response = await callRouteHandler(
      POST,
      createJsonRequest(URL, "POST", {
        partnerId: partner.user.id,
        reason: "Two minutes, side by side.",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.match.status).toBe("pending");
    expect(data.match.requesterId).toBe(requester.user.id);
    expect(data.match.partnerId).toBe(partner.user.id);
    expect(data.match.reason).toBe("Two minutes, side by side.");
    expect(data.workspace.id).toBe(requester.workspaceId);

    const db = await getTestDb();
    const stored = await db.query.pairMatch.findFirst({
      where: eq(pairMatchTable.requesterId, requester.user.id),
    });
    expect(stored?.status).toBe("pending");
    expect(stored?.partnerId).toBe(partner.user.id);
  });

  it("rejects when the linked task does not belong to the user", async () => {
    const requester = await seedMember();
    const partner = await seedMember({ workspaceId: requester.workspaceId });
    await mockSession(requester.user);

    const response = await callRouteHandler(
      POST,
      createJsonRequest(URL, "POST", {
        partnerId: partner.user.id,
        taskId: "nonexistent-task-id",
      })
    );
    expect(response.status).toBe(404);
  });

  it("links a valid task to the pair match", async () => {
    const requester = await seedMember();
    const partner = await seedMember({ workspaceId: requester.workspaceId });
    await mockSession(requester.user);

    const db = await getTestDb();
    const [task] = await db.insert(taskTable).values({
      userId: requester.user.id,
      title: "Draft the brief",
      micro: "Open the doc",
      action: "Write one line",
    }).returning();

    const response = await callRouteHandler(
      POST,
      createJsonRequest(URL, "POST", {
        partnerId: partner.user.id,
        taskId: task.id,
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.match.taskId).toBe(task.id);
  });
});

describe("GET /api/pair-match", () => {
  it("requires auth", async () => {
    const response = await callRouteHandler(GET, new Request(URL));
    expect(response.status).toBe(401);
  });

  it("returns matches where the user is requester or partner", async () => {
    const requester = await seedMember();
    const partner = await seedMember({ workspaceId: requester.workspaceId });
    await mockSession(requester.user);

    const createResponse = await callRouteHandler(
      POST,
      createJsonRequest(URL, "POST", { partnerId: partner.user.id })
    );
    expect(createResponse.status).toBe(200);

    await mockSession(partner.user);
    const response = await callRouteHandler(GET, new Request(URL));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.matches).toHaveLength(1);
    expect(data.matches[0].requesterId).toBe(requester.user.id);
    expect(data.matches[0].partnerId).toBe(partner.user.id);
  });
});
