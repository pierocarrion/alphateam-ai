import { db } from "@/server/lib/db";
import { channel, message, user, membership } from "@drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { container } from "@/server/lib/container";
import { createLogger } from "@/shared/lib/logger";
import {
  extractLeaderAnswerToKnowledge,
  generateAlphaResponse,
  isGeminiEnabled,
  shouldUseFallback,
  toFriendlyGeminiError,
} from "@/server/lib/gemini";
import { knowledgeContainer } from "@/features/knowledge/infrastructure/knowledgeContainer";
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

  // Ground Alpha on the project's Knowledge Hub using the same hybrid RAG
  // pipeline (semantic + keyword) the explicit @alpha commands use, so the
  // "general" path no longer reads a separate legacy table that drifted out
  // of sync. The user's own message is the query — natural-language questions
  // like "what technology will we use?" map to the relevant resource via the
  // embedder + FTS fusion in SearchKnowledge.hybrid.
  let knowledge: Array<{ title: string; content: string }> = [];
  try {
    const search = knowledgeContainer.searchKnowledge();
    const ranked = await search.hybrid({
      workspaceId: args.workspaceId,
      query: args.messageText,
      topK: 5,
    });
    knowledge = ranked
      .filter((r) => r.resource.title !== "(recurso no disponible)")
      .map((r) => ({
        title: r.resource.title,
        content: r.snippet || r.resource.summary || "",
      }));
  } catch (err) {
    log.error("knowledgeHub hybrid (reply) failed", err);
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

  if (!result.ok || !result.data) {
    // Graceful degradation: never leave an @alpha mention silently unanswered.
    // When Gemini is unavailable (rate-limited, transient, etc.) Alpha still
    // replies with a short, honest fallback so the user isn't left hanging.
    const name = args.senderName ?? "Piero";
    log.warn("generateAlphaResponse failed, using fallback", { error: result.error });
    return shouldUseFallback()
      ? `Hola ${name}, no pude procesar tu mensaje justo ahora. ${toFriendlyGeminiError(result.error)}`
      : null;
  }
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
    const [channelRow] = await db
      .select({ id: channel.id, workspaceId: channel.workspaceId })
      .from(channel)
      .where(eq(channel.id, args.channelId));
    if (!channelRow) return null;

    const [messageRows, membershipRows] = await Promise.all([
      db
        .select({ userId: message.userId, content: message.content })
        .from(message)
        .where(eq(message.channelId, args.channelId))
        .orderBy(desc(message.createdAt))
        .limit(8),
      db
        .select({ userId: membership.userId, role: membership.role })
        .from(membership)
        .where(eq(membership.workspaceId, channelRow.workspaceId)),
    ]);

    const leaderIds = new Set(
      membershipRows
        .filter((m) => m.role === "leader" || m.role === "admin")
        .map((m) => m.userId)
    );

    // Most recent prior message from a non-leader that looks like a question.
    const candidate = messageRows.find(
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
