import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isGeminiEnabled: vi.fn(),
  generateAlphaResponse: vi.fn(),
  extractLeaderAnswerToKnowledge: vi.fn(),
  shouldUseFallback: vi.fn(),
  toFriendlyGeminiError: vi.fn(),
  hybrid: vi.fn(),
}));

vi.mock("@/server/lib/gemini", () => ({
  isGeminiEnabled: mocks.isGeminiEnabled,
  generateAlphaResponse: mocks.generateAlphaResponse,
  extractLeaderAnswerToKnowledge: mocks.extractLeaderAnswerToKnowledge,
  shouldUseFallback: mocks.shouldUseFallback,
  toFriendlyGeminiError: mocks.toFriendlyGeminiError,
}));

// The "general" @Alpha path now grounds on the Knowledge Hub via the same
// `SearchKnowledge.hybrid` pipeline the explicit commands use. Stub the
// container's `searchKnowledge()` factory so we can drive the hybrid result
// deterministically without a live embedder / vector store in tests.
vi.mock("@/features/knowledge/infrastructure/knowledgeContainer", () => ({
  knowledgeContainer: {
    searchKnowledge: () => ({ hybrid: mocks.hybrid }),
  },
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
  mocks.shouldUseFallback.mockReturnValue(true);
  mocks.toFriendlyGeminiError.mockReturnValue("Please try again.");
  // By default hybrid returns an empty result list (no knowledge wired up).
  mocks.hybrid.mockResolvedValue([]);
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
  it("grounds the reply in the project Knowledge Hub (hybrid RAG)", async () => {
    const { workspace } = await seedWorkspace();
    // No legacy knowledgeBaseItem seeded — Alpha must read from Knowledge Hub.
    mocks.hybrid.mockResolvedValue([
      {
        resource: {
          id: "r1",
          title: "Tecnologías del proyecto",
          summary: "Se usará .NET y Flutter como frameworks de la app",
          tags: [],
          categoryId: null,
          isPremium: false,
          fileType: "text",
        },
        score: 0.9,
        snippet: "Se usará .NET y Flutter como frameworks de la app",
        source: "hybrid",
      },
    ]);

    mocks.generateAlphaResponse.mockResolvedValue({
      ok: true,
      data: "Se usará .NET y Flutter como frameworks.",
      model: "test",
    });

    const reply = await generateAlphaChannelReply({
      workspaceId: workspace.id,
      messageText: "@alpha qué tecnología se usará?",
      senderName: "Piero",
    });

    expect(reply).toBe("Se usará .NET y Flutter como frameworks.");
    expect(mocks.hybrid).toHaveBeenCalledWith({
      workspaceId: workspace.id,
      query: "@alpha qué tecnología se usará?",
      topK: 5,
    });
    const arg = mocks.generateAlphaResponse.mock.calls[0][0];
    expect(arg.knowledge).toEqual([
      {
        title: "Tecnologías del proyecto",
        content: "Se usará .NET y Flutter como frameworks de la app",
      },
    ]);
    expect(arg.message).toBe("@alpha qué tecnología se usará?");
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

  it("returns a friendly fallback when Gemini fails and fallback is on", async () => {
    const { workspace } = await seedWorkspace();
    mocks.generateAlphaResponse.mockResolvedValue({
      ok: false,
      error: "boom",
      model: "test",
    });
    mocks.toFriendlyGeminiError.mockReturnValue("Please try again.");
    const reply = await generateAlphaChannelReply({
      workspaceId: workspace.id,
      messageText: "@alpha hi",
      senderName: "Piero",
    });
    expect(reply).toBe("Hola Piero, no pude procesar tu mensaje justo ahora. Please try again.");
    expect(mocks.toFriendlyGeminiError).toHaveBeenCalledWith("boom");
  });

  it("returns null when Gemini fails and fallback is disabled", async () => {
    const { workspace } = await seedWorkspace();
    mocks.shouldUseFallback.mockReturnValue(false);
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
