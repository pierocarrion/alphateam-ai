import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";
import { seedMember, getTestPrisma } from "@/tests/helpers/db";
import { mockSession } from "@/tests/helpers/auth";
import { createJsonRequest, callRouteHandler } from "@/tests/helpers/fetch";

async function seedMemberAndMock() {
  const { user, channel } = await seedMember();
  await mockSession(user);
  return { user, channel };
}

describe("GET /api/channels/[id]/messages", () => {
  it("returns 401 when not authenticated", async () => {
    const { channel } = await seedMember();
    const request = new Request(`http://localhost:3000/api/channels/${channel.id}/messages`);
    const response = await callRouteHandler(GET, request, { id: channel.id });
    expect(response.status).toBe(401);
  });

  it("returns channel messages for a member", async () => {
    const { user, channel } = await seedMemberAndMock();

    const prisma = await getTestPrisma();
    await prisma.message.create({
      data: { channelId: channel.id, userId: user.id, content: "Hello team" },
    });

    const request = new Request(`http://localhost:3000/api/channels/${channel.id}/messages`);
    const response = await callRouteHandler(GET, request, { id: channel.id });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.channel.name).toBe("q3-launch");
    expect(data.messages.some((m: { text: string }) => m.text === "Hello team")).toBe(true);
  });

  it("returns 403 for a non-member", async () => {
    const { channel } = await seedMember();
    const { user } = await (await import("@/tests/helpers/db")).seedUser();
    await mockSession(user);

    const request = new Request(`http://localhost:3000/api/channels/${channel.id}/messages`);
    const response = await callRouteHandler(GET, request, { id: channel.id });
    expect(response.status).toBe(403);
  });
});

describe("POST /api/channels/[id]/messages", () => {
  it("saves a message and detects a task", async () => {
    const { channel } = await seedMemberAndMock();

    const request = createJsonRequest(`http://localhost:3000/api/channels/${channel.id}/messages`, "POST", {
      text: "I need to finish the report by Friday",
    });

    const response = await callRouteHandler(POST, request, { id: channel.id });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message.text).toBe("I need to finish the report by Friday");
    expect(data.detected).not.toBeNull();

    const prisma = await getTestPrisma();
    const messages = await prisma.message.findMany({ where: { channelId: channel.id } });
    expect(messages).toHaveLength(1);
  });

  it("saves a casual message without detection", async () => {
    const { channel } = await seedMemberAndMock();

    const request = createJsonRequest(`http://localhost:3000/api/channels/${channel.id}/messages`, "POST", {
      text: "Good morning!",
    });

    const response = await callRouteHandler(POST, request, { id: channel.id });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.detected).toBeNull();
  });

  it("rejects empty text", async () => {
    const { channel } = await seedMemberAndMock();

    const request = createJsonRequest(`http://localhost:3000/api/channels/${channel.id}/messages`, "POST", {
      text: "",
    });

    const response = await callRouteHandler(POST, request, { id: channel.id });
    expect(response.status).toBe(400);
  });
});

describe("DM channel access", () => {
  async function seedDm() {
    const { user, workspaceId } = await seedMember({ name: "Alice" });
    const partner = await seedMember({ name: "Bob", workspaceId });
    const prisma = await getTestPrisma();
    const dm = await prisma.channel.create({
      data: {
        workspaceId,
        name: `dm:${[user.id, partner.user.id].sort().join(":")}`,
        type: "dm",
        participants: {
          create: [{ userId: user.id }, { userId: partner.user.id }],
        },
      },
    });
    return { user, partner, dm, workspaceId };
  }

  it("allows a participant to read a DM", async () => {
    const { user, dm } = await seedDm();
    await mockSession(user);

    const request = new Request(`http://localhost:3000/api/channels/${dm.id}/messages`);
    const response = await callRouteHandler(GET, request, { id: dm.id });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.channel.type).toBe("dm");
    expect(data.peer).not.toBeNull();
  });

  it("blocks a workspace member who is not a DM participant", async () => {
    const { dm, workspaceId } = await seedDm();
    const intruder = await seedMember({ name: "Eve", workspaceId });
    await mockSession(intruder.user);

    const request = new Request(`http://localhost:3000/api/channels/${dm.id}/messages`);
    const response = await callRouteHandler(GET, request, { id: dm.id });
    expect(response.status).toBe(403);
  });
});
