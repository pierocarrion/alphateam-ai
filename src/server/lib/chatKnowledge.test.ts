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
import { getTestPrisma, seedWorkspace } from "@/tests/helpers/db";

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
    const prisma = await getTestPrisma();
    const { workspace } = await seedWorkspace();
    await prisma.knowledgeBaseItem.create({
      data: { workspaceId: workspace.id, title: "Refunds", content: "Refunds within 30 days." },
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
    const prisma = await getTestPrisma();
    const { workspace, channel } = await seedWorkspace();

    const leader = await prisma.user.create({
      data: { name: "Lead", email: `lead-${crypto.randomUUID()}@example.com`, passwordHash: "x", profile: { create: {} } },
    });
    await prisma.membership.create({
      data: { userId: leader.id, workspaceId: workspace.id, role: "leader" },
    });

    const member = await prisma.user.create({
      data: { name: "Mem", email: `mem-${crypto.randomUUID()}@example.com`, passwordHash: "x", profile: { create: {} } },
    });
    await prisma.membership.create({
      data: { userId: member.id, workspaceId: workspace.id, role: "member" },
    });

    await prisma.message.create({
      data: { channelId: channel.id, userId: member.id, content: "How do I reset my password?" },
    });
    await prisma.message.create({
      data: { channelId: channel.id, userId: leader.id, content: "Go to settings and click Reset password." },
    });

    return { workspace, channel, leader, member, prisma };
  }

  it("captures a leader's substantive answer to a member question", async () => {
    const { workspace, channel, leader, prisma } = await seedConversation();

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

    const kb = await prisma.knowledgeBaseItem.findMany({ where: { workspaceId: workspace.id } });
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
    const prisma = await getTestPrisma();
    // Remove the member's question, leaving only a non-question member message.
    await prisma.message.deleteMany({ where: { userId: member.id } });
    await prisma.message.create({
      data: { channelId: channel.id, userId: member.id, content: "Good morning team" },
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
