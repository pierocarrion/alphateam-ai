import { db } from "@/server/lib/db";
import { channel, message, user, workspace, channelInsight, membership, task } from "@drizzle/schema";
import { eq, desc, asc, sql } from "drizzle-orm";
import { getAiClient } from "@/server/lib/ai";
import { container } from "@/server/lib/container";
import { createLogger } from "@/shared/lib/logger";
import { knowledgeContainer } from "@/features/knowledge/infrastructure/knowledgeContainer";
import {
  AlphaCommandRouter,
  parseAlphaCommand,
  type ConversationMessage,
  type AlphaCommandContext,
  type AlphaCommandResult,
} from "@/features/chat/application/alphaCommands";
import { publishRealtime } from "@/server/lib/realtime";

const log = createLogger("alpha");

export interface RunAlphaOptions {
  channelId: string;
  text: string;
  /** Limit how many recent messages feed the analysis. */
  historyLimit?: number;
}

export interface RunAlphaOutput {
  parsed: ReturnType<typeof parseAlphaCommand>;
  result: AlphaCommandResult;
}

/**
 * High-level orchestrator: given a chat message that mentions Alpha, it parses
 * the command, builds the conversation context, optionally retrieves Knowledge
 * Hub resources (RAG) for `fetch`, runs the router, and persists the structured
 * output as a ChannelInsight. Used by both the inline @alpha path and the
 * explicit /api/channels/[id]/alpha endpoint.
 */
export async function runAlphaInChannel(opts: RunAlphaOptions): Promise<RunAlphaOutput> {
  const parsed = parseAlphaCommand(opts.text);
  const historyLimit = opts.historyLimit ?? 30;

  const [channelRow] = await db
    .select({
      id: channel.id,
      workspaceId: channel.workspaceId,
      workspaceName: workspace.name,
    })
    .from(channel)
    .leftJoin(workspace, eq(workspace.id, channel.workspaceId))
    .where(eq(channel.id, opts.channelId));

  const messageRows = channelRow
    ? await db
        .select({
          content: message.content,
          userName: user.name,
          createdAt: message.createdAt,
        })
        .from(message)
        .leftJoin(user, eq(user.id, message.userId))
        .where(eq(message.channelId, opts.channelId))
        .orderBy(desc(message.createdAt))
        .limit(historyLimit)
    : [];

  const conversation: ConversationMessage[] = messageRows
    .slice()
    .reverse()
    .map((m) => ({ author: m.userName ?? "Someone", text: m.content }));

  const ctx: AlphaCommandContext = {
    workspaceId: channelRow?.workspaceId ?? "",
    channelId: opts.channelId,
    projectName: channelRow?.workspaceName ?? undefined,
    conversation,
  };

  // RAG retrieval: always ground Alpha on the project's Knowledge Hub so she can
  // answer questions about any project data in any command, not just `fetch`.
  if (ctx.workspaceId && parsed.argument) {
    try {
      const search = knowledgeContainer.searchKnowledge();
      const ranked = await search.hybrid({
        workspaceId: ctx.workspaceId,
        query: parsed.argument,
        topK: parsed.command === "fetch" ? 5 : 4,
      });
      ctx.knowledge = ranked
        .filter((r) => r.resource.title !== "(recurso no disponible)")
        .map((r) => ({ title: r.resource.title, snippet: r.snippet || r.resource.summary || "" }));
    } catch (err) {
      log.error("grounding retrieval error", err);
    }
  }

  const router = new AlphaCommandRouter(getAiClient());
  const result = await router.run(parsed, ctx);

  // Persist the structured insight for the side panel + audit trail.
  if (channelRow && ctx.workspaceId) {
    try {
      await db.insert(channelInsight).values({
        channelId: opts.channelId,
        workspaceId: ctx.workspaceId,
        type: parsed.command,
        payload: {
          reply: result.reply,
          usedAi: result.usedAi,
          argument: parsed.argument,
          ...(result.structured ?? {}),
        },
      });
    } catch (err) {
      log.error("persist insight error", err);
    }
    // Notify connected clients that a new Alpha insight is available.
    publishRealtime("alpha_insight", {
      workspaceId: ctx.workspaceId,
      channelId: opts.channelId,
      data: { type: parsed.command, usedAi: result.usedAi },
    });
  }

  // For the "tasks" command, also create real Task rows from the analysis so
  // they land in the existing task system. Best-effort, never blocks the reply.
  if (parsed.command === "tasks" && result.usedAi) {
    try {
      await materializeTasksFromReply(opts.channelId, result.reply, ctx.workspaceId);
    } catch (err) {
      log.error("materialize tasks error", err);
    }
  }

  return { parsed, result };
}

async function materializeTasksFromReply(
  channelId: string,
  reply: string,
  workspaceId: string
): Promise<void> {
  // Find the channel members so we can attribute extracted tasks to plausible owners.
  const [firstMembership] = await db
    .select({ userId: membership.userId })
    .from(membership)
    .where(eq(membership.workspaceId, workspaceId))
    .orderBy(asc(membership.joinedAt))
    .limit(1);
  const fallbackUserId = firstMembership?.userId;
  if (!fallbackUserId) return;

  // The reply is markdown bullets; record it as a single knowledge-capture task
  // so the leader can review/convert. (Full NLP extraction happens in the
  // analytical layer; this guarantees traceability in the task system.)
  const [existing] = await db
    .select({ id: task.id })
    .from(task)
    .where(
      sql`${task.title} LIKE ${"Acciones detectadas por Alpha%"} AND ${task.status} = 'open'`
    )
    .limit(1);
  if (existing) return;
  await db.insert(task).values({
    userId: fallbackUserId,
    title: "Acciones detectadas por Alpha",
    category: "Review",
    app: "Alpha",
    load: "Light",
    micro: "Revisar las acciones detectadas por Alpha y asignarlas.",
    action: "revisar y asignar",
    resource: "Chat",
    fromQuote: reply.slice(0, 200),
    status: "open",
    tags: ["alpha", "auto-detected"],
  });
  void channelId;
}
