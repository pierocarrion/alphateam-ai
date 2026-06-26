import { prisma } from "@/server/lib/prisma";
import { container } from "@/server/lib/container";
import { createLogger } from "@/shared/lib/logger";
import {
  extractLeaderAnswerToKnowledge,
  generateAlphaResponse,
  isGeminiEnabled,
} from "@/server/lib/gemini";
import type { KnowledgeBaseItem } from "@/features/projects/domain/repositories/IProjectRepository";

const log = createLogger("chatKnowledge");

/**
 * Matches "@alpha", "alpha," / "alpha?" / "hey alpha" at a word boundary.
 * The "@" must be at the start of the message or preceded by whitespace, so
 * substrings like "mirage", "admirable" or "email@alpha" do not trigger it.
 */
const ALPHA_MENTION_PATTERN = /(?:^|\s)@?alpha\b/i;

export function isMentionedAlpha(text: string): boolean {
  return ALPHA_MENTION_PATTERN.test(text);
}

/**
 * Generates Alpha's reply grounded in the project knowledge base.
 * Returns null when Gemini is disabled or fails (graceful degradation).
 */
export async function generateAlphaChannelReply(args: {
  workspaceId: string;
  messageText: string;
  senderName?: string | null;
}): Promise<string | null> {
  if (!isGeminiEnabled()) return null;

  let knowledge: Array<{ title: string; content: string }> = [];
  try {
    const items = await container.projectRepository.listKnowledge(args.workspaceId);
    knowledge = items.map((k) => ({ title: k.title, content: k.content }));
  } catch (err) {
    log.error("listKnowledge (reply) failed", err);
  }

  let projectContext: {
    name?: string;
    description?: string;
    industry?: string;
    category?: string;
  } | null = null;
  try {
    const project = await container.projectRepository.findById(args.workspaceId);
    if (project) {
      projectContext = {
        name: project.name,
        description: project.description ?? undefined,
        industry: project.industry ?? undefined,
        category: project.category ?? undefined,
      };
    }
  } catch (err) {
    log.error("findById (reply) failed", err);
  }

  const result = await generateAlphaResponse({
    userName: args.senderName ?? undefined,
    message: args.messageText,
    knowledge,
    projectContext,
  });

  if (!result.ok || !result.data) return null;
  return result.data.trim();
}

/**
 * When a project leader answers a question in chat, attempt to extract the Q&A
 * and append it to the project knowledge base. Returns the created item, or null
 * when there is nothing worth saving. Best-effort: never throws.
 */
export async function maybeCaptureLeaderAnswer(args: {
  workspaceId: string;
  channelId: string;
  leaderUserId: string;
  leaderMessageText: string;
}): Promise<KnowledgeBaseItem | null> {
  if (!isGeminiEnabled()) return null;
  // If the leader is addressing Alpha, this isn't a reusable answer to capture.
  if (isMentionedAlpha(args.leaderMessageText)) return null;

  try {
    const channel = await prisma.channel.findUnique({
      where: { id: args.channelId },
      include: {
        messages: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 8,
        },
        workspace: { include: { memberships: true } },
      },
    });
    if (!channel) return null;

    const leaderIds = new Set(
      channel.workspace.memberships
        .filter((m) => m.role === "leader" || m.role === "admin")
        .map((m) => m.userId)
    );

    // Most recent prior message from a non-leader that looks like a question.
    const candidate = channel.messages.find(
      (m) =>
        m.userId !== args.leaderUserId &&
        !leaderIds.has(m.userId) &&
        /\?\s*$/.test(m.content.trim())
    );
    if (!candidate) return null;

    let existingTitles: string[] = [];
    try {
      const items = await container.projectRepository.listKnowledge(args.workspaceId);
      existingTitles = items.map((k) => k.title);
    } catch (err) {
      log.error("listKnowledge (titles) failed", err);
    }

    const extraction = await extractLeaderAnswerToKnowledge({
      question: candidate.content,
      leaderAnswer: args.leaderMessageText,
      existingKnowledgeTitles: existingTitles,
    });
    if (!extraction.ok || !extraction.data) return null;

    const e = extraction.data;
    if (!e.isAnswer || e.duplicate || !e.title?.trim() || !e.content?.trim()) return null;

    return await container.projectRepository.addKnowledge(args.workspaceId, {
      title: e.title.trim(),
      content: e.content.trim(),
    });
  } catch (err) {
    log.error("maybeCaptureLeaderAnswer failed", err);
    return null;
  }
}
