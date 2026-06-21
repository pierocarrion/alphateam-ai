import { describe, expect, it } from "vitest";
import { POST, GET } from "./route";
import { seedMember, getTestPrisma } from "@/tests/helpers/db";
import { mockSession } from "@/tests/helpers/auth";
import { createJsonRequest, callRouteHandler } from "@/tests/helpers/fetch";

const URL = "http://localhost:3000/api/dms";

describe("POST /api/dms", () => {
  it("requires auth", async () => {
    const response = await callRouteHandler(
      POST,
      createJsonRequest(URL, "POST", { partnerId: "x" })
    );
    expect(response.status).toBe(401);
  });

  it("creates a DM channel with both participants", async () => {
    const { user, workspaceId } = await seedMember({ name: "Alice" });
    const partner = await seedMember({ name: "Bob", workspaceId });
    await mockSession(user);

    const response = await callRouteHandler(
      POST,
      createJsonRequest(URL, "POST", { partnerId: partner.user.id })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.created).toBe(true);
    expect(data.channel.type).toBe("dm");

    const prisma = await getTestPrisma();
    const participants = await prisma.channelParticipant.findMany({
      where: { channelId: data.channel.id },
    });
    expect(participants).toHaveLength(2);
    expect(participants.map((p) => p.userId).sort()).toEqual(
      [user.id, partner.user.id].sort()
    );
  });

  it("returns the existing DM on second call (find, not create)", async () => {
    const { user, workspaceId } = await seedMember({ name: "Alice" });
    const partner = await seedMember({ name: "Bob", workspaceId });
    await mockSession(user);

    const first = await callRouteHandler(
      POST,
      createJsonRequest(URL, "POST", { partnerId: partner.user.id })
    );
    const firstData = await first.json();

    await mockSession(user);
    const second = await callRouteHandler(
      POST,
      createJsonRequest(URL, "POST", { partnerId: partner.user.id })
    );
    const secondData = await second.json();

    expect(secondData.created).toBe(false);
    expect(secondData.channel.id).toBe(firstData.channel.id);
  });

  it("rejects a partner outside the workspace", async () => {
    const { user } = await seedMember({ name: "Alice" });
    const outsider = await seedMember({ name: "Carol" });
    await mockSession(user);

    const response = await callRouteHandler(
      POST,
      createJsonRequest(URL, "POST", { partnerId: outsider.user.id })
    );
    expect(response.status).toBe(404);
  });

  it("rejects a DM with yourself", async () => {
    const { user } = await seedMember({ name: "Alice" });
    await mockSession(user);

    const response = await callRouteHandler(
      POST,
      createJsonRequest(URL, "POST", { partnerId: user.id })
    );
    expect(response.status).toBe(400);
  });
});

describe("GET /api/dms", () => {
  it("lists the user's DMs with peer info", async () => {
    const { user, workspaceId } = await seedMember({ name: "Alice" });
    const partner = await seedMember({ name: "Bob", workspaceId });
    await mockSession(user);

    await callRouteHandler(
      POST,
      createJsonRequest(URL, "POST", { partnerId: partner.user.id })
    );

    await mockSession(user);
    const response = await callRouteHandler(GET, new Request(URL));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.dms).toHaveLength(1);
    expect(data.dms[0].peer.name).toBe("Bob");
  });
});
