import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isGeminiEnabled: vi.fn(),
  generateAlphaResponse: vi.fn(),
  extractLeaderAnswerToKnowledge: vi.fn(),
}));

vi.mock("@/server/lib/gemini", () => ({
  isGeminiEnabled: mocks.isGeminiEnabled,
  generateAlphaResponse: mocks.generateAlphaResponse,
  extractLeaderAnswerToKnowledge: mocks.extractLeaderAnswerToKnowledge,
}));

import {
  isMentionedAlpha,
  generateAlphaChannelReply,
  maybeCaptureLeaderAnswer,
} from "./chatKnowledge";
import { getTestDb, seedWorkspace } from "@/tests/helpers/db";
import { eq } from "drizzle-orm";
import {
  user as userTable,
  userProfile,
  membership,
  message as messageTable,
  knowledgeBaseItem,
} from "@drizzle/schema";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isGeminiEnabled.mockReturnValue(true);
});

describe("isMentionedAlpha", () => {
  it.each([
    "@alpha what's up?",
    "hey alpha, help me",
    "Alpha?",
    "Hey @Alpha!",
    "ALPHA help",
    "  alpha ",
    "hello\n@alpha can you?",
  ])("detects a mention in %j", (text) => {
    expect(isMentionedAlpha(text)).toBe(true);
  });

  it.each([
    "mirage",
    "admirable",
    "good morning",
    "email@alpha",
    "we admire the plan",
    "",
  ])("does not detect a mention in %j", (text) => {
    expect(isMentionedAlpha(text)).toBe(false);
  });
});

describe("generateAlphaChannelReply", () => {
  it("grounds the reply in the project knowledge base", async () => {
    const db = await getTestDb();
    const { workspace } = await seedWorkspace();
    await db.insert(knowledgeBaseItem).values({
      workspaceId: workspace.id,
      title: "Refunds",
      content: "Refunds within 30 days.",
    });

    mocks.generateAlphaResponse.mockResolvedValue({
      ok: true,
      data: "You can refund within 30 days.",
      model: "test",
    });

    const reply = await generateAlphaChannelReply({
      workspaceId: workspace.id,
      messageText: "@alpha what is the refund policy?",
      senderName: "Mem",
    });

    expect(reply).toBe("You can refund within 30 days.");
    expect(mocks.generateAlphaResponse).toHaveBeenCalledOnce();
    const arg = mocks.generateAlphaResponse.mock.calls[0][0];
    expect(arg.knowledge).toEqual([{ title: "Refunds", content: "Refunds within 30 days." }]);
    expect(arg.message).toBe("@alpha what is the refund policy?");
  });

  it("returns null when Gemini is disabled", async () => {
    mocks.isGeminiEnabled.mockReturnValue(false);
    const reply = await generateAlphaChannelReply({
      workspaceId: "ws",
      messageText: "@alpha hi",
    });
    expect(reply).toBeNull();
    expect(mocks.generateAlphaResponse).not.toHaveBeenCalled();
  });

  it("returns null when Gemini fails", async () => {
    const { workspace } = await seedWorkspace();
    mocks.generateAlphaResponse.mockResolvedValue({
      ok: false,
      error: "boom",
      model: "test",
    });
    const reply = await generateAlphaChannelReply({
      workspaceId: workspace.id,
      messageText: "@alpha hi",
    });
    expect(reply).toBeNull();
  });
});

describe("maybeCaptureLeaderAnswer", () => {
  async function seedConversation() {
    const db = await getTestDb();
    const { workspace, channel } = await seedWorkspace();

    const [leader] = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(userTable)
        .values({
          name: "Lead",
          email: `lead-${crypto.randomUUID()}@example.com`,
          passwordHash: "x",
        })
        .returning();
      await tx.insert(userProfile).values({ userId: u!.id });
      return [u!] as const;
    });
    await db
      .insert(membership)
      .values({ userId: leader.id, workspaceId: workspace.id, role: "leader" });

    const [member] = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(userTable)
        .values({
          name: "Mem",
          email: `mem-${crypto.randomUUID()}@example.com`,
          passwordHash: "x",
        })
        .returning();
      await tx.insert(userProfile).values({ userId: u!.id });
      return [u!] as const;
    });
    await db
      .insert(membership)
      .values({ userId: member.id, workspaceId: workspace.id, role: "member" });

    await db
      .insert(messageTable)
      .values({
        channelId: channel.id,
        userId: member.id,
        content: "How do I reset my password?",
      });
    await db
      .insert(messageTable)
      .values({
        channelId: channel.id,
        userId: leader.id,
        content: "Go to settings and click Reset password.",
      });

    return { workspace, channel, leader, member, db };
  }

  it("captures a leader's substantive answer to a member question", async () => {
    const { workspace, channel, leader, db } = await seedConversation();

    mocks.extractLeaderAnswerToKnowledge.mockResolvedValue({
      ok: true,
      data: {
        isAnswer: true,
        title: "Reset password",
        content: "Go to settings and click Reset password.",
        duplicate: false,
        confidence: 0.9,
      },
      model: "test",
    });

    const item = await maybeCaptureLeaderAnswer({
      workspaceId: workspace.id,
      channelId: channel.id,
      leaderUserId: leader.id,
      leaderMessageText: "Go to settings and click Reset password.",
    });

    expect(item).not.toBeNull();
    expect(item?.title).toBe("Reset password");

    const kb = await db.query.knowledgeBaseItem.findMany({
      where: eq(knowledgeBaseItem.workspaceId, workspace.id),
    });
    expect(kb).toHaveLength(1);
    expect(kb[0].title).toBe("Reset password");
    expect(mocks.extractLeaderAnswerToKnowledge).toHaveBeenCalledOnce();
    expect(mocks.extractLeaderAnswerToKnowledge.mock.calls[0][0].question).toMatch(/reset my password/i);
  });

  it("does not capture a duplicate answer", async () => {
    const { workspace, channel, leader } = await seedConversation();
    mocks.extractLeaderAnswerToKnowledge.mockResolvedValue({
      ok: true,
      data: { isAnswer: true, title: "Reset password", content: "...", duplicate: true, confidence: 0.5 },
      model: "test",
    });
    const item = await maybeCaptureLeaderAnswer({
      workspaceId: workspace.id,
      channelId: channel.id,
      leaderUserId: leader.id,
      leaderMessageText: "Go to settings and click Reset password.",
    });
    expect(item).toBeNull();
  });

  it("does not capture a non-answer (chitchat)", async () => {
    const { workspace, channel, leader } = await seedConversation();
    mocks.extractLeaderAnswerToKnowledge.mockResolvedValue({
      ok: true,
      data: { isAnswer: false, title: "", content: "", duplicate: false, confidence: 0.2 },
      model: "test",
    });
    const item = await maybeCaptureLeaderAnswer({
      workspaceId: workspace.id,
      channelId: channel.id,
      leaderUserId: leader.id,
      leaderMessageText: "Go to settings and click Reset password.",
    });
    expect(item).toBeNull();
  });

  it("does nothing when the leader is addressing Alpha", async () => {
    const { workspace, channel, leader } = await seedConversation();
    const item = await maybeCaptureLeaderAnswer({
      workspaceId: workspace.id,
      channelId: channel.id,
      leaderUserId: leader.id,
      leaderMessageText: "@alpha what is our refund policy?",
    });
    expect(item).toBeNull();
    expect(mocks.extractLeaderAnswerToKnowledge).not.toHaveBeenCalled();
  });

  it("returns null when there is no prior member question", async () => {
    const { workspace, channel, leader, member } = await seedConversation();
    const db = await getTestDb();
    await db.delete(messageTable).where(eq(messageTable.userId, member.id));
    await db
      .insert(messageTable)
      .values({
        channelId: channel.id,
        userId: member.id,
        content: "Good morning team",
      });

    const item = await maybeCaptureLeaderAnswer({
      workspaceId: workspace.id,
      channelId: channel.id,
      leaderUserId: leader.id,
      leaderMessageText: "Go to settings and click Reset password.",
    });
    expect(item).toBeNull();
    expect(mocks.extractLeaderAnswerToKnowledge).not.toHaveBeenCalled();
  });

  it("returns null when Gemini is disabled", async () => {
    mocks.isGeminiEnabled.mockReturnValue(false);
    const { workspace, channel, leader } = await seedConversation();
    const item = await maybeCaptureLeaderAnswer({
      workspaceId: workspace.id,
      channelId: channel.id,
      leaderUserId: leader.id,
      leaderMessageText: "Go to settings and click Reset password.",
    });
    expect(item).toBeNull();
    expect(mocks.extractLeaderAnswerToKnowledge).not.toHaveBeenCalled();
  });
});
