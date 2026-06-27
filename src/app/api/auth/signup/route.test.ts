import { describe, expect, it } from "vitest";
import { POST } from "./route";
import { getTestDb } from "@/tests/helpers/db";
import { createJsonRequest } from "@/tests/helpers/fetch";
import { user as userTable } from "@drizzle/schema";
import { eq } from "drizzle-orm";

describe("POST /api/auth/signup", () => {
  it("creates a new user", async () => {
    const request = createJsonRequest("http://localhost:3000/api/auth/signup", "POST", {
      email: "signup@example.com",
      name: "Signup User",
      password: "password123",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.email).toBe("signup@example.com");
    expect(data.user.name).toBe("Signup User");

    const db = await getTestDb();
    const row = await db.query.user.findFirst({ where: eq(userTable.email, "signup@example.com") });
    expect(row).not.toBeNull();
  });

  it("rejects invalid input", async () => {
    const request = createJsonRequest("http://localhost:3000/api/auth/signup", "POST", {
      email: "not-an-email",
      name: "",
      password: "short",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Please enter a valid email address.");
    expect(data.error).not.toContain("Invalid");
  });

  it("rejects duplicate emails", async () => {
    const db = await getTestDb();
    await db.insert(userTable).values({ email: "exists@example.com", name: "Existing", passwordHash: "hash" });

    const request = createJsonRequest("http://localhost:3000/api/auth/signup", "POST", {
      email: "exists@example.com",
      name: "New",
      password: "password123",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/already registered/i);
  });

  it("returns a friendly message for malformed JSON", async () => {
    const request = new Request("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Please send a valid request.");
  });
});
