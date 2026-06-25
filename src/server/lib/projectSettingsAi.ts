import { generateJSON } from "./gemini";
import type { SmartGoal } from "@/features/project-settings/domain/entities";
import {
  KPI_CATALOG,
  METHODOLOGIES,
  type InsightType,
  type KpiCatalogItem,
  type Severity,
} from "@/features/project-settings/domain/catalog";

export interface SmartValidationResult {
  score: number;
  checks: Array<{ dimension: "specific" | "measurable" | "achievable" | "relevant" | "timeBound"; ok: boolean; feedback: string }>;
  suggestions: string[];
  improvedDraft: {
    specific: string;
    measurable: string;
    achievable: string;
    relevant: string;
    timeBound: string;
  };
}

const FRIENDLY_AI_UNAVAILABLE =
  "No pudimos analizar el objetivo con la IA en este momento. Inténtalo de nuevo.";

export async function analyzeSmartGoalWithAi(goal: SmartGoal): Promise<{
  ok: boolean;
  data?: SmartValidationResult;
  error?: string;
}> {
  const prompt = `You are a project-strategy coach. Analyze this SMART objective and rate each dimension.

Title: ${goal.title}
Specific: ${goal.specific ?? "(empty)"}
Measurable: ${goal.measurable ?? "(empty)"}
Achievable: ${goal.achievable ?? "(empty)"}
Relevant: ${goal.relevant ?? "(empty)"}
Time-bound: ${goal.timeBound ?? "(empty)"}
Deadline: ${goal.deadline ?? "(none)"}

Respond with JSON only:
{
  "score": 0-100,
  "checks": [
    { "dimension": "specific", "ok": true|false, "feedback": "one short sentence" }
    // one per dimension: specific, measurable, achievable, relevant, timeBound
  ],
  "suggestions": ["3 concrete improvements, max 18 words each"],
  "improvedDraft": {
    "specific": "polished version",
    "measurable": "polished version",
    "achievable": "polished version",
    "relevant": "polished version",
    "timeBound": "polished version"
  }
}`;

  const result = await generateJSON<SmartValidationResult>(prompt, {
    maxTokens: 700,
    temperature: 0.3,
  });
  if (!result.ok || !result.data) {
    console.error("[ai] analyzeSmartGoalWithAi failed", {
      error: result.error,
      model: result.model,
    });
    return { ok: false, error: FRIENDLY_AI_UNAVAILABLE };
  }
  return { ok: true, data: result.data };
}

export interface ProjectContextForAi {
  projectName: string;
  goal: SmartGoal | null;
  primaryMethodology: string | null;
  secondaryMethodologies: string[];
  members: Array<{ name: string | null; projectRole: string | null }>;
  activeKpis: KpiCatalogItem[];
}

export interface GeneratedInsight {
  type: InsightType;
  severity: Severity | null;
  title: string;
  detail: string;
}

export interface AiInsightBundle {
  risks: GeneratedInsight[];
  recommendations: GeneratedInsight[];
  alerts: GeneratedInsight[];
  actionPlan: string[];
  suggestedMetrics: string[];
  workloadDistribution: Array<{ role: string; suggestedShare: number; rationale: string }>;
}

export async function generateProjectInsights(
  context: ProjectContextForAi
): Promise<{ ok: boolean; data?: AiInsightBundle; error?: string }> {
  const methodologyName = (key: string) =>
    METHODOLOGIES.find((m) => m.key === key)?.name ?? key;

  const prompt = `You are a senior delivery strategist AI for a project management platform.
Analyze the project configuration and produce actionable insights.

Project: ${context.projectName}
Primary methodology: ${methodologyName(context.primaryMethodology ?? "")}
Secondary methodologies: ${context.secondaryMethodologies.map(methodologyName).join(", ") || "(none)"}

SMART goal:
- Title: ${context.goal?.title ?? "(none)"}
- Specific: ${context.goal?.specific ?? "(none)"}
- Measurable: ${context.goal?.measurable ?? "(none)"}
- Achievable: ${context.goal?.achievable ?? "(none)"}
- Relevant: ${context.goal?.relevant ?? "(none)"}
- Time-bound: ${context.goal?.timeBound ?? "(none)"}

Team (${context.members.length} members):
${context.members.map((m) => `- ${m.name ?? "Unknown"} — ${m.projectRole ?? "no role"}`).join("\n")}

Active KPIs: ${context.activeKpis.map((k) => k.name).join(", ") || "(none)"}

Respond with JSON only:
{
  "risks": [{ "type": "risk", "severity": "low|medium|high", "title": "short", "detail": "1-2 sentences" }],
  "recommendations": [{ "type": "recommendation", "severity": null, "title": "short", "detail": "1-2 sentences" }],
  "alerts": [{ "type": "alert", "severity": "low|medium|high", "title": "short", "detail": "1-2 sentences" }],
  "actionPlan": ["5 ordered concrete actions, max 16 words each"],
  "suggestedMetrics": ["3-5 metrics that fit this project, beyond the active ones"],
  "workloadDistribution": [{ "role": "role name", "suggestedShare": 0-100, "rationale": "short rationale" }]
}`;

  const result = await generateJSON<AiInsightBundle>(prompt, {
    maxTokens: 1100,
    temperature: 0.35,
  });
  if (!result.ok || !result.data) {
    console.error("[ai] generateProjectInsights failed", {
      error: result.error,
      model: result.model,
    });
    return { ok: false, error: FRIENDLY_AI_UNAVAILABLE };
  }
  return { ok: true, data: result.data };
}

export function kpiCatalogByKey(): Record<string, KpiCatalogItem> {
  return Object.fromEntries(KPI_CATALOG.map((k) => [k.key, k]));
}
