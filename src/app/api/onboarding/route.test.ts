import { describe, expect, it } from "vitest";
import { POST } from "./route";
import { seedUser, getTestDb } from "@/tests/helpers/db";
import { mockSession } from "@/tests/helpers/auth";
import { createJsonRequest } from "@/tests/helpers/fetch";
import { userProfile } from "@drizzle/schema";
import { eq } from "drizzle-orm";

describe("POST /api/onboarding", () => {
  it("returns 401 when not authenticated", async () => {
    const request = createJsonRequest("http://localhost:3000/api/onboarding", "POST", {
      role: "Engineer",
      hardMoment: "Mornings",
      profileId: "rbp",
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("completes onboarding for the authenticated user", async () => {
    const { user } = await seedUser();
    await mockSession(user);

    const request = createJsonRequest("http://localhost:3000/api/onboarding", "POST", {
      role: "Designer",
      hardMoment: "Afternoons",
      profileId: "multi",
      tone: "balanced",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.profile.onboarded).toBe(true);
    expect(data.profile.role).toBe("Designer");

    const db = await getTestDb();
    const profile = await db.query.userProfile.findFirst({ where: eq(userProfile.userId, user.id) });
    expect(profile?.onboarded).toBe(true);
  });

  it("returns 400 for invalid input", async () => {
    const { user } = await seedUser();
    await mockSession(user);

    const request = createJsonRequest("http://localhost:3000/api/onboarding", "POST", {
      role: "",
      hardMoment: "",
      profileId: "",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
