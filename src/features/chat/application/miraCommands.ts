import type { AiClient } from "@/server/lib/ai/client";
import type { KnowledgeResource } from "@/features/knowledge/domain/entities/KnowledgeResource";

/**
 * Parsing + dispatch for natural-language @Mira commands inside the Group Chat.
 *
 * Supported intents (extensible via {@link COMMANDS}):
 *   @mira resume / summarize this conversation
 *   @mira identify risks / riesgos
 *   @mira create tasks / crea tareas pendientes
 *   @mira generate a retrospective / retrospectiva
 *   @mira create a strategy / estrategia comercial
 *   @mira fetch: <topic>          (RAG retrieval over the Knowledge Hub)
 *
 * Intent detection is language-agnostic (ES/EN keywords) and falls back to a
 * general grounded answer when no command matches.
 */
export type MiraCommandId =
  | "summary"
  | "risks"
  | "tasks"
  | "retrospective"
  | "strategy"
  | "fetch"
  | "general";

export interface ParsedCommand {
  command: MiraCommandId;
  argument?: string;
  raw: string;
}

interface CommandDef {
  id: MiraCommandId;
  keywords: string[];
}

const COMMANDS: CommandDef[] = [
  { id: "summary", keywords: ["resume", "resumen", "summarize", "summarise", "recap", "resum"] },
  { id: "risks", keywords: ["risk", "riesgo", "blocker", "blockers", "identifica riesgos", "identify risks"] },
  { id: "tasks", keywords: ["task", "tarea", "tareas", "action items", "pendiente", "pendientes", "create tasks", "crea tareas"] },
  { id: "retrospective", keywords: ["retro", "retrospectiva", "retrospective", "retrospect"] },
  { id: "strategy", keywords: ["strategy", "estrategia", "plan estratégico", "strategic plan", "go-to-market", "comercial"] },
];

const FETCH_PATTERN = /fetch\s*:\s*(.+)|fetch\s+(.+)/i;

export function parseMiraCommand(rawText: string): ParsedCommand {
  const text = rawText.trim();
  // Remove leading "@mira" / "mira," token so keyword matching is stable.
  const stripped = text
    .replace(/(?:^|\s)@?\s*mira\b[,:]?\s*/i, "")
    .trim();

  const fetchMatch = stripped.match(FETCH_PATTERN);
  if (fetchMatch) {
    return { command: "fetch", argument: (fetchMatch[1] ?? fetchMatch[2] ?? "").trim(), raw: text };
  }

  const lower = stripped.toLowerCase();
  for (const def of COMMANDS) {
    if (def.keywords.some((k) => lower.includes(k.toLowerCase()))) {
      return { command: def.id, argument: stripped, raw: text };
    }
  }
  return { command: "general", argument: stripped, raw: text };
}

export interface ConversationMessage {
  author: string;
  text: string;
}

export interface MiraCommandContext {
  workspaceId: string;
  channelId: string;
  projectName?: string;
  conversation: ConversationMessage[];
  /** Knowledge Hub resources available for grounding (already retrieved). */
  knowledge?: { title: string; snippet: string }[];
}

export interface MiraCommandResult {
  command: MiraCommandId;
  /** Markdown-ish text reply to post back into the channel. */
  reply: string;
  /** Structured payload to persist as a ChannelInsight (optional). */
  structured?: Record<string, unknown>;
  /** Whether the active AI provider actually answered (vs. graceful fallback). */
  usedAi: boolean;
  /** Resources fetched from the Knowledge Hub (for "fetch" / grounding). */
  fetchedResources?: KnowledgeResource[];
}

/**
 * Pure dispatcher: maps a parsed command to the right prompt + schema, calls
 * the provider, and returns a normalized result. Depends only on {@link AiClient}
 * so it is trivially testable with a fake client.
 */
export class MiraCommandRouter {
  constructor(private readonly ai: AiClient) {}

  async run(parsed: ParsedCommand, ctx: MiraCommandContext): Promise<MiraCommandResult> {
    const conversationBlock = formatConversation(ctx.conversation);
    const knowledgeBlock = ctx.knowledge?.length
      ? `\n\nRelevant knowledge from the project's Knowledge Hub:\n${ctx.knowledge.map((k) => `- ${k.title}: ${k.snippet}`).join("\n")}`
      : "";

    switch (parsed.command) {
      case "summary":
        return this.ask(
          parsed,
          `Summarize this team conversation. Return a concise summary with: participants, key agreements, open tasks, identified risks, and next steps. Use bullet points.${knowledgeBlock}\n\nConversation:\n${conversationBlock}`,
          "summary"
        );
      case "risks":
        return this.ask(
          parsed,
          `Analyze this conversation and surface operational risks, blockers, dependencies, and delays. For each, note severity (low/medium/high) and a suggested mitigation.${knowledgeBlock}\n\nConversation:\n${conversationBlock}`,
          "risks"
        );
      case "tasks":
        return this.ask(
          parsed,
          `Extract all implicit tasks, assignments and commitments from this conversation. For each: title, owner (if identifiable), due date (if mentioned), priority, and the quote that implies it.${knowledgeBlock}\n\nConversation:\n${conversationBlock}`,
          "tasks"
        );
      case "retrospective":
        return this.ask(
          parsed,
          `Run a retrospective on this conversation: what went well, what didn't, and concrete improvements. Be specific and grounded in the messages.${knowledgeBlock}\n\nConversation:\n${conversationBlock}`,
          "retrospective"
        );
      case "strategy":
        return this.ask(
          parsed,
          `Draft a strategic/commercial plan relevant to this conversation: objectives, target audience, key initiatives, KPIs, risks, and a 30/60/90-day roadmap. Use the project context.${knowledgeBlock}\n\nConversation:\n${conversationBlock}`,
          "strategy"
        );
      case "fetch":
        return this.fetch(parsed, ctx, conversationBlock);
      case "general":
      default:
        return this.ask(
          parsed,
          `You are Mira, embedded in a team's project chat and you were @mentioned. The user's latest message is: "${parsed.argument ?? parsed.raw}". Respond naturally and warmly. If it's a greeting ("hola", "hi", "qué tal"), greet back in the SAME language and offer help. If it's a question, answer directly using the project context and knowledge below when relevant.${knowledgeBlock}\n\nConversation context:\n${conversationBlock}\n\nCRITICAL: Reply in the same language as the user's latest message (Spanish→Spanish, English→English, etc.). Keep it concise (max 4 sentences) and friendly, like a teammate.`,
          "general"
        );
    }
  }

  private async ask(
    parsed: ParsedCommand,
    prompt: string,
    bucket: string
  ): Promise<MiraCommandResult> {
    if (!this.ai.provider.isEnabled()) {
      return {
        command: parsed.command,
        reply:
          "I'm here, but AI isn't enabled right now so I can't generate that. Try again in a moment.",
        usedAi: false,
      };
    }
    const res = await this.ai.provider.chat({
      system:
        "You are Mira, a sharp, concise project analyst embedded in a team chat. Ground every answer strictly in the provided conversation and knowledge. Use markdown bullets. Never invent facts. LANGUAGE RULE (highest priority): Detect the language of the user's latest message and ALWAYS reply in that exact same language. If the user writes in Spanish, reply in Spanish. If in English, reply in English. Match the user's language precisely — never default to English.",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 700,
      temperature: 0.3,
    });
    if (!res.ok || !res.data) {
      return {
        command: parsed.command,
        reply: res.friendlyError ?? "I couldn't process that with AI right now.",
        usedAi: false,
      };
    }
    return {
      command: parsed.command,
      reply: res.data,
      structured: { bucket, prompt: parsed.argument },
      usedAi: true,
    };
  }

  private async fetch(
    parsed: ParsedCommand,
    ctx: MiraCommandContext,
    conversationBlock: string
  ): Promise<MiraCommandResult> {
    // The actual RAG retrieval is performed by the caller (who has the repo);
    // here we synthesize a grounded answer from the supplied knowledge.
    const topic = parsed.argument ?? "(no topic)";
    if (!ctx.knowledge || ctx.knowledge.length === 0) {
      return {
        command: "fetch",
        reply: `I searched the Knowledge Hub for "${topic}" but found nothing indexed yet. Upload or create a resource and I'll ground future answers on it.`,
        usedAi: false,
      };
    }
    if (!this.ai.provider.isEnabled()) {
      return {
        command: "fetch",
        reply: `From the Knowledge Hub on "${topic}":\n${ctx.knowledge.map((k) => `- ${k.title} — ${k.snippet}`).join("\n")}`,
        usedAi: false,
        structured: { topic, count: ctx.knowledge.length },
      };
    }
    const res = await this.ai.provider.chat({
      system:
        "You are Mira answering a @mira fetch: request. Synthesize a grounded, concise answer using ONLY the provided knowledge snippets. Cite titles inline. If the snippets don't cover the request, say so plainly. LANGUAGE RULE: Always reply in the same language as the user's request.",
      messages: [
        {
          role: "user",
          content: `Request: fetch "${topic}"\n\nKnowledge:\n${ctx.knowledge.map((k) => `### ${k.title}\n${k.snippet}`).join("\n\n")}\n\nConversation context (optional):\n${conversationBlock}`,
        },
      ],
      maxTokens: 500,
      temperature: 0.25,
    });
    if (!res.ok || !res.data) {
      return {
        command: "fetch",
        reply: res.friendlyError ?? "I couldn't process that fetch right now.",
        usedAi: false,
      };
    }
    return {
      command: "fetch",
      reply: res.data,
      structured: { topic, count: ctx.knowledge.length },
      usedAi: true,
    };
  }
}

export function formatConversation(messages: ConversationMessage[]): string {
  if (messages.length === 0) return "(empty conversation)";
  return messages.map((m) => `- ${m.author}: ${m.text}`).join("\n");
}
