import { describe, expect, it } from "vitest";
import { GET, PATCH } from "./route";
import { seedUser, getTestDb } from "@/tests/helpers/db";
import { mockSession } from "@/tests/helpers/auth";
import { createJsonRequest, callRouteHandler } from "@/tests/helpers/fetch";
import { userProfile } from "@drizzle/schema";
import { eq } from "drizzle-orm";

const URL = "http://localhost:3000/api/settings";

describe("GET /api/settings", () => {
  it("requires auth", async () => {
    const response = await callRouteHandler(GET, new Request(URL));
    expect(response.status).toBe(401);
  });

  it("returns defaults when the user has no profile settings yet", async () => {
    const { user } = await seedUser();
    await mockSession(user);

    const response = await callRouteHandler(GET, new Request(URL));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.gentleCheckIns).toBe(true);
    expect(data.quietMode).toBe(false);
  });
});

describe("PATCH /api/settings", () => {
  it("persists toggles to the user profile", async () => {
    const { user } = await seedUser();
    await mockSession(user);

    const request = createJsonRequest(URL, "PATCH", {
      gentleCheckIns: false,
      quietMode: true,
      tone: "balanced",
    });
    const response = await callRouteHandler(PATCH, request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.gentleCheckIns).toBe(false);
    expect(data.quietMode).toBe(true);
    expect(data.tone).toBe("balanced");

    const db = await getTestDb();
    const profile = await db.query.userProfile.findFirst({
      where: eq(userProfile.userId, user.id),
    });
    expect(profile?.gentleCheckIns).toBe(false);
    expect(profile?.quietMode).toBe(true);
    expect(profile?.tone).toBe("balanced");
  });

  it("rejects an invalid tone", async () => {
    const { user } = await seedUser();
    await mockSession(user);

    const request = createJsonRequest(URL, "PATCH", { tone: "loud" });
    const response = await callRouteHandler(PATCH, request);
    expect(response.status).toBe(400);
  });
});
