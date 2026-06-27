import { describe, expect, it } from "vitest";
import { GET, PATCH, DELETE } from "./route";
import { seedUser, getTestDb } from "@/tests/helpers/db";
import { mockSession } from "@/tests/helpers/auth";
import { createJsonRequest, callRouteHandler } from "@/tests/helpers/fetch";
import { task as taskTable } from "@drizzle/schema";
import { eq } from "drizzle-orm";

async function seedTaskForUser(userId: string) {
  const db = await getTestDb();
  const [task] = await db
    .insert(taskTable)
    .values({
      userId,
      title: "Test task",
      fromQuote: "“test”",
      category: "General",
      app: "Knowledge base",
      micro: "Do the first tiny thing",
      action: "first tiny thing",
      status: "open",
    })
    .returning();
  return task!;
}

describe("GET /api/tasks/[id]", () => {
  it("returns the user's task", async () => {
    const { user } = await seedUser();
    await mockSession(user);
    const task = await seedTaskForUser(user.id);

    const request = new Request(`http://localhost:3000/api/tasks/${task.id}`);
    const response = await callRouteHandler(GET, request, { id: task.id });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.task.id).toBe(task.id);
  });

  it("returns 404 for another user's task", async () => {
    const { user } = await seedUser();
    await mockSession(user);
    const otherUser = await (await import("@/tests/helpers/db")).seedUser();
    const task = await seedTaskForUser(otherUser.user.id);

    const request = new Request(`http://localhost:3000/api/tasks/${task.id}`);
    const response = await callRouteHandler(GET, request, { id: task.id });
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/tasks/[id]", () => {
  it("updates task status to done", async () => {
    const { user } = await seedUser();
    await mockSession(user);
    const task = await seedTaskForUser(user.id);

    const request = createJsonRequest(`http://localhost:3000/api/tasks/${task.id}`, "PATCH", {
      status: "done",
      completedAt: new Date().toISOString(),
    });
    const response = await callRouteHandler(PATCH, request, { id: task.id });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.task.status).toBe("done");
    expect(data.task.completedAt).not.toBeNull();
  });
});

describe("DELETE /api/tasks/[id]", () => {
  it("deletes the user's task", async () => {
    const { user } = await seedUser();
    await mockSession(user);
    const task = await seedTaskForUser(user.id);

    const request = new Request(`http://localhost:3000/api/tasks/${task.id}`, { method: "DELETE" });
    const response = await callRouteHandler(DELETE, request, { id: task.id });

    expect(response.status).toBe(200);

    const db = await getTestDb();
    const deleted = await db.query.task.findFirst({
      where: eq(taskTable.id, task.id),
    });
    expect(deleted ?? null).toBeNull();
  });
});
