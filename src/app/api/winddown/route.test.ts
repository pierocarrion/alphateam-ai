import { describe, expect, it } from "vitest";
import { POST, GET } from "./route";
import { seedUser, getTestDb } from "@/tests/helpers/db";
import { mockSession } from "@/tests/helpers/auth";
import { createJsonRequest, callRouteHandler } from "@/tests/helpers/fetch";
import { userMetric } from "@drizzle/schema";
import { and, eq } from "drizzle-orm";

const URL = "http://localhost:3000/api/winddown";

describe("POST /api/winddown", () => {
  it("requires auth", async () => {
    const response = await callRouteHandler(
      POST,
      createJsonRequest(URL, "POST", {})
    );
    expect(response.status).toBe(401);
  });

  it("records a wind_down user metric", async () => {
    const { user } = await seedUser();
    await mockSession(user);

    const response = await callRouteHandler(
      POST,
      createJsonRequest(URL, "POST", { mood: "calm" })
    );
    expect(response.status).toBe(200);

    const db = await getTestDb();
    const metric = await db.query.userMetric.findFirst({
      where: and(
        eq(userMetric.userId, user.id),
        eq(userMetric.type, "wind_down")
      ),
    });
    expect(metric?.value).toBe(1);
    expect(metric?.metadata).toBe("calm");
  });
});

describe("GET /api/winddown", () => {
  it("returns the count of wind-downs this week", async () => {
    const { user } = await seedUser();
    await mockSession(user);
    const db = await getTestDb();
    await db.insert(userMetric).values({
      userId: user.id,
      type: "wind_down",
      value: 1,
      date: new Date(),
    });

    const response = await callRouteHandler(GET, new Request(URL));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(1);
  });
});
