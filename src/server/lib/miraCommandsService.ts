import { prisma } from "@/server/lib/prisma";
import { getAiClient } from "@/server/lib/ai";
import { container } from "@/server/lib/container";
import { knowledgeContainer } from "@/features/knowledge/infrastructure/knowledgeContainer";
import {
  MiraCommandRouter,
  parseMiraCommand,
  type ConversationMessage,
  type MiraCommandContext,
  type MiraCommandResult,
} from "@/features/chat/application/miraCommands";

export interface RunMiraOptions {
  channelId: string;
  text: string;
  /** Limit how many recent messages feed the analysis. */
  historyLimit?: number;
}

export interface RunMiraOutput {
  parsed: ReturnType<typeof parseMiraCommand>;
  result: MiraCommandResult;
}

/**
 * High-level orchestrator: given a chat message that mentions Mira, it parses
 * the command, builds the conversation context, optionally retrieves Knowledge
 * Hub resources (RAG) for `fetch`, runs the router, and persists the structured
 * output as a ChannelInsight. Used by both the inline @mira path and the
 * explicit /api/channels/[id]/mira endpoint.
 */
export async function runMiraInChannel(opts: RunMiraOptions): Promise<RunMiraOutput> {
  const parsed = parseMiraCommand(opts.text);
  const historyLimit = opts.historyLimit ?? 30;

  const channel = await prisma.channel.findUnique({
    where: { id: opts.channelId },
    include: {
      messages: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: historyLimit,
      },
      workspace: { select: { id: true, name: true } },
    },
  });

  const conversation: ConversationMessage[] = (channel?.messages ?? [])
    .slice()
    .reverse()
    .map((m) => ({ author: m.user.name ?? "Someone", text: m.content }));

  const ctx: MiraCommandContext = {
    workspaceId: channel?.workspaceId ?? "",
    channelId: opts.channelId,
    projectName: channel?.workspace.name,
    conversation,
  };

  // RAG retrieval for fetch commands (and light grounding for analytical ones).
  if (parsed.command === "fetch" && parsed.argument && ctx.workspaceId) {
    try {
      const search = knowledgeContainer.searchKnowledge();
      const ranked = await search.hybrid({
        workspaceId: ctx.workspaceId,
        query: parsed.argument,
        topK: 5,
      });
      ctx.knowledge = ranked
        .filter((r) => r.resource.title !== "(recurso no disponible)")
        .map((r) => ({ title: r.resource.title, snippet: r.snippet || r.resource.summary || "" }));
    } catch (err) {
      console.error("[runMiraInChannel] fetch retrieval error:", err);
    }
  }

  const router = new MiraCommandRouter(getAiClient());
  const result = await router.run(parsed, ctx);

  // Persist the structured insight for the side panel + audit trail.
  if (channel && ctx.workspaceId) {
    try {
      await prisma.channelInsight.create({
        data: {
          channelId: opts.channelId,
          workspaceId: ctx.workspaceId,
          type: parsed.command,
          payload: {
            reply: result.reply,
            usedAi: result.usedAi,
            argument: parsed.argument,
            ...(result.structured ?? {}),
          },
        },
      });
    } catch (err) {
      console.error("[runMiraInChannel] persist insight error:", err);
    }
  }

  // For the "tasks" command, also create real Task rows from the analysis so
  // they land in the existing task system. Best-effort, never blocks the reply.
  if (parsed.command === "tasks" && result.usedAi) {
    try {
      await materializeTasksFromReply(opts.channelId, result.reply, ctx.workspaceId);
    } catch (err) {
      console.error("[runMiraInChannel] materialize tasks error:", err);
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
  const membership = await prisma.membership.findFirst({
    where: { workspaceId },
    orderBy: { joinedAt: "asc" },
    include: { user: { select: { id: true } } },
  });
  const fallbackUserId = membership?.user.id;
  if (!fallbackUserId) return;

  // The reply is markdown bullets; record it as a single knowledge-capture task
  // so the leader can review/convert. (Full NLP extraction happens in the
  // analytical layer; this guarantees traceability in the task system.)
  const existing = await prisma.task.findFirst({
    where: { title: { startsWith: "Acciones detectadas por Mira" }, status: "open" },
  });
  if (existing) return;
  await prisma.task.create({
    data: {
      userId: fallbackUserId,
      title: "Acciones detectadas por Mira",
      category: "Review",
      app: "Mira",
      load: "Light",
      micro: "Revisar las acciones detectadas por Mira y asignarlas.",
      action: "revisar y asignar",
      resource: "Chat",
      fromQuote: reply.slice(0, 200),
      status: "open",
      tags: ["mira", "auto-detected"],
    },
  });
  void channelId;
}
