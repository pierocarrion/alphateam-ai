import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";
import { seedMember, getTestDb } from "@/tests/helpers/db";
import { mockSession } from "@/tests/helpers/auth";
import { createJsonRequest, callRouteHandler } from "@/tests/helpers/fetch";
import {
  channel as channelTable,
  channelParticipant as channelParticipantTable,
  message as messageTable,
} from "@drizzle/schema";
import { eq } from "drizzle-orm";

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

    const db = await getTestDb();
    await db.insert(messageTable).values({
      channelId: channel.id,
      userId: user.id,
      content: "Hello team",
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

    const db = await getTestDb();
    const messages = await db.query.message.findMany({ where: eq(messageTable.channelId, channel.id) });
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
    const db = await getTestDb();
    const [dm] = await db.transaction(async (tx) => {
      const [c] = await tx.insert(channelTable).values({
        workspaceId,
        name: `dm:${[user.id, partner.user.id].sort().join(":")}`,
        type: "dm",
      }).returning();
      await tx.insert(channelParticipantTable).values({ channelId: c!.id, userId: user.id });
      await tx.insert(channelParticipantTable).values({ channelId: c!.id, userId: partner.user.id });
      return [c!] as const;
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
