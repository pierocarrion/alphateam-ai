import { describe, expect, it } from "vitest";
import { POST } from "./route";
import { seedUser, getTestDb } from "@/tests/helpers/db";
import { mockSession } from "@/tests/helpers/auth";
import { createJsonRequest } from "@/tests/helpers/fetch";
import { task as taskTable } from "@drizzle/schema";

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

describe("POST /api/rituals", () => {
  it("returns 401 when not authenticated", async () => {
    const request = createJsonRequest("http://localhost:3000/api/rituals", "POST", {
      taskId: "task-id",
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("creates a ritual session for the user's task", async () => {
    const { user } = await seedUser();
    await mockSession(user);
    const task = await seedTaskForUser(user.id);

    const request = createJsonRequest("http://localhost:3000/api/rituals", "POST", {
      taskId: task.id,
      feeling: "anxious",
      durationSec: 120,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ritual.userId).toBe(user.id);
    expect(data.ritual.taskId).toBe(task.id);
    expect(data.ritual.feeling).toBe("anxious");
  });

  it("rejects a taskId from another user", async () => {
    const { user } = await seedUser();
    await mockSession(user);
    const otherUser = await (await import("@/tests/helpers/db")).seedUser();
    const task = await seedTaskForUser(otherUser.user.id);

    const request = createJsonRequest("http://localhost:3000/api/rituals", "POST", {
      taskId: task.id,
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("rejects missing taskId", async () => {
    const { user } = await seedUser();
    await mockSession(user);

    const request = createJsonRequest("http://localhost:3000/api/rituals", "POST", {});
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
