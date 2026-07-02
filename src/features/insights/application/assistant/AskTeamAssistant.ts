import { z } from "zod";
import type { TeamOverview } from "../../domain/entities/TeamOverview";
import type { AiClient } from "@/server/lib/ai/client";
import { serializeTeamOverview } from "./contextSerializer";
import {
  ASSISTANT_SYSTEM_PROMPT,
  buildAssistantUserPrompt,
} from "./prompts";

export const askTeamAssistantInputSchema = z.object({
  question: z.string().trim().min(1, "Please ask a question.").max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })
    )
    .max(20)
    .optional(),
  locale: z.enum(["es", "en"]).optional(),
  daysWindow: z.number().int().min(1).max(365).optional(),
});

export type AskTeamAssistantInput = z.infer<typeof askTeamAssistantInputSchema>;

export type AssistantConfidence = "High" | "Medium" | "Low";

export interface AssistantAnswer {
  reply: string;
  confidence: AssistantConfidence;
  confidenceReason: string;
  recommendedActions: string[];
  evidence: string[];
  /** True when the AI provider produced the answer (vs. a graceful fallback). */
  usedAi: boolean;
}

/**
 * Empty-state guidance returned without hitting the model when the dashboard
 * has no members yet. Matches the spec's "your dashboard is still collecting
 * data" guidance.
 */
export const EMPTY_DASHBOARD_GUIDANCE: AssistantAnswer = {
  reply:
    "Your dashboard is still collecting data. Once your team starts completing tasks, feedback surveys and learning activities, I'll be able to provide deeper insights and personalized recommendations.",
  confidence: "Low",
  confidenceReason:
    "There are no team members yet, so no metrics can be computed.",
  recommendedActions: [
    "Invite your team members to this workspace.",
    "Create the first tasks so Productivity Risk and Workload can be calculated.",
    "Launch a feedback round so Psychological Safety has real data.",
  ],
  evidence: [],
  usedAi: false,
};

/**
 * Use case: answer a Team Leader's question about the Team Insights dashboard.
 *
 * - Depends only on {@link AiClient} (Dependency Inversion), so it is trivially
 *   testable with a fake provider.
 * - Receives the freshly-assembled {@link TeamOverview} from the caller (the
 *   HTTP route), which guarantees the model reasons over the exact same data
 *   the leader is viewing.
 * - Enforces the JSON output contract and degrades gracefully when the provider
 *   is disabled, errors, or returns malformed JSON.
 */
export class AskTeamAssistant {
  constructor(private readonly ai: AiClient) {}

  async execute(
    input: AskTeamAssistantInput,
    overview: TeamOverview
  ): Promise<AssistantAnswer> {
    if (overview.headcount === 0) {
      return localizeEmptyGuidance(input.locale);
    }

    if (!this.ai.provider.isEnabled()) {
      return {
        reply:
          "I'm here, but AI isn't enabled right now so I can't analyze the dashboard. Try again in a moment.",
        confidence: "Low",
        confidenceReason: "AI provider is disabled.",
        recommendedActions: [],
        evidence: [],
        usedAi: false,
      };
    }

    const dashboardContext = serializeTeamOverview(overview);
    const userPrompt = buildAssistantUserPrompt({
      dashboardContext,
      question: input.question,
      history: input.history,
      locale: input.locale,
      daysWindow: input.daysWindow,
    });

    const res = await this.ai.provider.chatJSON<AssistantAnswer>({
      system: ASSISTANT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 900,
      temperature: 0.25,
      json: true,
    });

    if (!res.ok || !res.data) {
      return {
        reply:
          res.friendlyError ??
          "I couldn't analyze the dashboard right now. Please try again in a moment.",
        confidence: "Low",
        confidenceReason: "The AI provider did not return a valid answer.",
        recommendedActions: [],
        evidence: [],
        usedAi: false,
      };
    }

    return normalizeAnswer(res.data);
  }
}

/**
 * Normalizes whatever the model returned into the strict {@link AssistantAnswer}
 * shape (defensive: models occasionally add fields, drop arrays, or use wrong
 * confidence labels). Never throws.
 */
export function normalizeAnswer(raw: Partial<AssistantAnswer>): AssistantAnswer {
  const reply = typeof raw.reply === "string" && raw.reply.trim().length > 0
    ? raw.reply.trim()
    : "I couldn't shape a clear answer from the data. Try rephrasing the question.";

  const confidence: AssistantConfidence =
    raw.confidence === "High" || raw.confidence === "Medium" || raw.confidence === "Low"
      ? raw.confidence
      : "Medium";

  const confidenceReason =
    typeof raw.confidenceReason === "string"
      ? raw.confidenceReason.trim()
      : "";

  const recommendedActions = Array.isArray(raw.recommendedActions)
    ? raw.recommendedActions
        .map((a) => (typeof a === "string" ? a.trim() : ""))
        .filter((a) => a.length > 0)
        .slice(0, 5)
    : [];

  const evidence = Array.isArray(raw.evidence)
    ? raw.evidence
        .map((e) => (typeof e === "string" ? e.trim() : ""))
        .filter((e) => e.length > 0)
        .slice(0, 6)
    : [];

  return {
    reply,
    confidence,
    confidenceReason,
    recommendedActions,
    evidence,
    usedAi: true,
  };
}

function localizeEmptyGuidance(locale?: string): AssistantAnswer {
  if (locale === "es") {
    return {
      reply:
        "Tu dashboard todavía está recolectando datos. Una vez que tu equipo empiece a completar tareas, encuestas de feedback y actividades de aprendizaje, podré ofrecerte análisis más profundos y recomendaciones personalizadas.",
      confidence: "Low",
      confidenceReason:
        "Aún no hay miembros en el equipo, por lo que ninguna métrica puede calcularse.",
      recommendedActions: [
        "Invita a los miembros de tu equipo a este workspace.",
        "Crea las primeras tareas para que se calculen Productivity Risk y Workload.",
        "Inicia una ronda de feedback para que Psychological Safety tenga datos reales.",
      ],
      evidence: [],
      usedAi: false,
    };
  }
  return EMPTY_DASHBOARD_GUIDANCE;
}
