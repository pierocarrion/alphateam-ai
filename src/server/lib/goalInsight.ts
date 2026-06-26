import { generateJSON } from "./gemini";
import { createLogger } from "@/shared/lib/logger";
import type { GoalProgressReport, Insight } from "@/features/projects/domain/entities/SmartGoal";

const log = createLogger("goalInsight");

export interface GoalInsightResult {
  insights: Insight[];
  usedGemini: boolean;
}

/**
 * AI Insights layer for the SMART Goal Progress Tracker.
 *
 * Asks Gemini (Vertex AI) to read the deterministic report and produce warm,
 * non-shaming observations. Falls back to the heuristic insights (computed by
 * the engine) whenever Gemini is disabled, unavailable or returns garbage —
 * matching the codebase convention of "fallback to existing heuristics".
 */
export async function generateGoalInsights(
  report: GoalProgressReport
): Promise<GoalInsightResult> {
  const heuristic = report.insights;

  const prompt = `You are Alpha, a warm, non-shaming team productivity analyst embedded in a project tracker.
Given this deterministic progress report, write 3 to 5 short, kind, actionable insights for the project leader.

Rules:
- Be specific and reference the real numbers and names from the report.
- Never blame a person; frame load concentration as something to ease together.
- Each insight is ONE sentence, under 24 words, in Spanish.
- Return JSON only.

Report:
${JSON.stringify(
  {
    goalTitle: report.goalTitle,
    progress: report.progress,
    topContributors: report.contributions.members.slice(0, 3).map((c) => ({
      name: c.name,
      share: c.share,
      contributionScore: c.contributionScore,
    })),
    risks: report.risks.map((r) => ({ title: r.title, level: r.level })),
    prediction: report.prediction,
    health: report.health,
  },
  null,
  2
)}

Respond with JSON only:
{
  "insights": [
    { "kind": "gap | concentration | risk | recommendation | win", "text": "una frase corta" }
  ]
}`;

  const result = await generateJSON<{ insights: Array<{ kind: Insight["kind"]; text: string }> }>(
    prompt,
    { maxTokens: 400, temperature: 0.3 }
  );

  if (!result.ok || !result.data?.insights?.length) {
    if (!result.ok && result.error) {
      log.error("Gemini error", result.error);
    }
    return { insights: heuristic, usedGemini: false };
  }

  const insights: Insight[] = result.data.insights
    .filter((i) => typeof i.text === "string" && i.text.trim().length > 0)
    .slice(0, 5)
    .map((i, index) => ({
      id: `ai-${index}`,
      kind: (["gap", "concentration", "risk", "recommendation", "win"].includes(
        i.kind
      )
        ? i.kind
        : "recommendation") as Insight["kind"],
      text: i.text.trim(),
    }));

  return {
    insights: insights.length ? insights : heuristic,
    usedGemini: true,
  };
}

export interface CopilotAnswer {
  answer: string;
  usedGemini: boolean;
}

/**
 * AI Copilot for the SMART Goal Progress Tracker. Answers natural-language
 * questions about a goal using its computed report as grounding context (RAG
 * over the report). Falls back to a deterministic summary when Gemini is off.
 */
export async function answerGoalCopilotQuestion(
  question: string,
  report: GoalProgressReport
): Promise<CopilotAnswer> {
  const fallback = buildFallbackAnswer(question, report);

  const prompt = `You are Alpha, a warm project-progress copilot. Answer the leader's question in friendly, concise Spanish (max 3 sentences), grounded ONLY on this goal report. If the report doesn't contain the answer, say so gently.

Goal report:
${JSON.stringify(
  {
    title: report.goalTitle,
    progress: report.progress,
    contributions: report.contributions.members.slice(0, 5),
    risks: report.risks,
    prediction: report.prediction,
    health: report.health,
    recentTimeline: report.timeline.slice(0, 6),
  },
  null,
  2
)}

Leader question: """${question}"""

Reply in plain text, no markdown.`;

  const result = await generateJSON<{ answer?: string }>(
    `Respond with JSON only: {"answer": "tu respuesta en español"}.\n\n${prompt}`,
    { maxTokens: 220, temperature: 0.3 }
  );

  if (!result.ok || !result.data?.answer?.trim()) {
    return { answer: fallback, usedGemini: false };
  }
  return { answer: result.data.answer.trim(), usedGemini: true };
}

function buildFallbackAnswer(
  question: string,
  report: GoalProgressReport
): string {
  const q = question.toLowerCase();
  if (/quien|aporta|m[aá]s contribuy/.test(q)) {
    const top = report.contributions.members[0];
    return top
      ? `${top.name} es quien más aporta, con el ${top.share}% del avance (score ${top.contributionScore}).`
      : "Aún no hay contribuciones registradas para este objetivo.";
  }
  if (/hito|complet|esta semana|semama/.test(q)) {
    const recent = report.timeline
      .filter((t) => t.type === "milestone" || t.type === "task_done")
      .slice(0, 3);
    if (!recent.length) return "No hay hitos ni tareas completadas recientemente.";
    return `Recientemente: ${recent.map((t) => t.title).join(", ")}.`;
  }
  if (/probab|a tiempo|fecha|termin/.test(q)) {
    const p = report.prediction;
    return `Probabilidad de cumplir: ${p.completionProbability}%. Riesgo: ${p.riskLevel}. ${
      p.estimatedFinishDate
        ? `Estimado: ${new Date(p.estimatedFinishDate).toLocaleDateString()}.`
        : ""
    }`;
  }
  if (/tarea|impact|progres/.test(q)) {
    return `El objetivo va al ${report.progress.goalProgress}% (esperado ${report.progress.expectedProgress}%), estado: ${report.progress.status}.`;
  }
  return `El objetivo "${report.goalTitle}" va al ${report.progress.goalProgress}% con salud ${report.health.healthScore}/100.`;
}
