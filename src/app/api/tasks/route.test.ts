import { describe, expect, it } from "vitest";
import { POST } from "./route";
import { seedUser, getTestDb } from "@/tests/helpers/db";
import { mockSession } from "@/tests/helpers/auth";
import { createJsonRequest } from "@/tests/helpers/fetch";
import { deriveTask } from "@/features/tasks/lib/detect";
import { task as taskTable } from "@drizzle/schema";
import { eq } from "drizzle-orm";

describe("POST /api/tasks", () => {
  it("returns 401 when not authenticated", async () => {
    const request = createJsonRequest("http://localhost:3000/api/tasks", "POST", {
      draft: deriveTask("Finish the report"),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("creates a task from a detected draft", async () => {
    const { user } = await seedUser();
    await mockSession(user);

    const draft = deriveTask("Finish the Q3 report");
    const request = createJsonRequest("http://localhost:3000/api/tasks", "POST", { draft });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.task.userId).toBe(user.id);
    expect(data.task.title).toBe(draft.title);
    expect(data.task.status).toBe("open");

    const db = await getTestDb();
    const tasks = await db.query.task.findMany({
      where: eq(taskTable.userId, user.id),
    });
    expect(tasks).toHaveLength(1);
  });

  it("rejects a missing draft", async () => {
    const { user } = await seedUser();
    await mockSession(user);

    const request = createJsonRequest("http://localhost:3000/api/tasks", "POST", {});
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
