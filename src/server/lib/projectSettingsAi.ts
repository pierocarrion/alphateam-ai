import { generateJSON } from "./gemini";
import { createLogger } from "@/shared/lib/logger";
import type { SmartGoal } from "@/features/project-settings/domain/entities";
import {
  KPI_CATALOG,
  METHODOLOGIES,
  PROJECT_ROLES,
  type InsightType,
  type KpiCatalogItem,
  type Severity,
} from "@/features/project-settings/domain/catalog";
import type {
  ProposedAction,
  SmartGoalProposedAction,
  MethodologyProposedAction,
  KpiProposedAction,
  RoleProposedAction,
} from "@/features/project-settings/domain/proposedActions";

const log = createLogger("ai");

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
    log.error("analyzeSmartGoalWithAi failed", {
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
  /**
   * Acciones estructuradas y ejecutables que el cliente puede aplicar con un
   * solo clic desde "Configuración inteligente IA". Se sanean (claves válidas
   * del catálogo, roles existentes, miembros reales) antes de devolverse.
   */
  proposedActions: ProposedAction[];
}

/** Shape crudo que devuelve el LLM antes del saneamiento. */
interface RawProposedAction {
  kind: string;
  label?: string;
  rationale?: string;
  confidence?: number;
  goal?: Record<string, string>;
  addSecondary?: string[];
  removeSecondary?: string[];
  kpiKey?: string;
  kpiName?: string;
  enabled?: boolean;
  target?: number | null;
  alertThreshold?: number | null;
  memberName?: string;
  projectRole?: string;
}

export async function generateProjectInsights(
  context: ProjectContextForAi
): Promise<{ ok: boolean; data?: AiInsightBundle; error?: string }> {
  const methodologyName = (key: string) =>
    METHODOLOGIES.find((m) => m.key === key)?.name ?? key;
  const methodologyKeyByName = (name: string) =>
    METHODOLOGIES.find(
      (m) => m.name.toLowerCase() === name.toLowerCase() || m.key === name
    )?.key;
  const kpiByKeyOrName = (raw: string) =>
    KPI_CATALOG.find(
      (k) => k.key === raw || k.name.toLowerCase() === raw.toLowerCase()
    );
  const roleByKeyOrName = (raw: string) =>
    PROJECT_ROLES.find(
      (r) => r.key === raw || r.name.toLowerCase() === raw.toLowerCase()
    );

  const validMethodologyKeys = METHODOLOGIES.map((m) => m.key).join(", ");
  const validKpiKeys = KPI_CATALOG.map((k) => `${k.key} (${k.name})`).join(", ");
  const validRoleKeys = PROJECT_ROLES.map((r) => `${r.key} (${r.name})`).join(", ");
  const memberNames = context.members
    .map((m) => m.name)
    .filter((n): n is string => Boolean(n));

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
  "workloadDistribution": [{ "role": "role name", "suggestedShare": 0-100, "rationale": "short rationale" }],
  "proposedActions": [
    // Concrete, executable changes the user can apply with one click.
    // Only include an action if it is clearly valuable AND maps to the allowed enums below.
    // Reference REAL member names and valid keys; invalid entries are silently dropped.
    // Limit to 6 actions, prioritized by impact.
    {
      "kind": "smart_goal",
      "label": "Afinar objetivo SMART",
      "rationale": "1 short sentence",
      "confidence": 0-100,
      "goal": { "specific": "rewritten text", "measurable": "...", "achievable": "...", "relevant": "...", "timeBound": "YYYY-MM-DD or text" }
    },
    {
      "kind": "methodology",
      "label": "Añadir/quitar metodologías secundarias",
      "rationale": "1 short sentence",
      "confidence": 0-100,
      "addSecondary": ["valid methodology keys"],
      "removeSecondary": ["valid methodology keys"]
    },
    {
      "kind": "kpi",
      "label": "Activar KPI recomendado",
      "rationale": "1 short sentence",
      "confidence": 0-100,
      "kpiKey": "valid_kpi_key",
      "kpiName": "Human name",
      "enabled": true,
      "target": 42,
      "alertThreshold": 25
    },
    {
      "kind": "role",
      "label": "Asignar rol a miembro",
      "rationale": "1 short sentence",
      "confidence": 0-100,
      "memberName": "exact existing member name",
      "projectRole": "valid_role_key",
      "roleName": "Human name"
    }
  ]
}

VALID methodology keys: ${validMethodologyKeys}
VALID kpi keys: ${validKpiKeys}
VALID project role keys: ${validRoleKeys}
EXISTING member names: ${memberNames.length ? memberNames.join(", ") : "(none — do not propose role actions)"}

The primary methodology is immutable: never propose changing it, only add/remove secondaries.
For role actions, memberName MUST be one of the EXISTING member names above.`;

  const result = await generateJSON<AiInsightBundle & { proposedActions?: RawProposedAction[] }>(
    prompt,
    {
      maxTokens: 4096,
      temperature: 0.35,
    }
  );
  if (!result.ok || !result.data) {
    log.error("generateProjectInsights failed", {
      error: result.error,
      model: result.model,
    });
    return { ok: false, error: FRIENDLY_AI_UNAVAILABLE };
  }

  const sanitized = sanitizeProposedActions(
    result.data.proposedActions ?? [],
    {
      methodologyKeyByName,
      kpiByKeyOrName,
      roleByKeyOrName,
      memberNames: new Set(memberNames),
      alreadyActiveKpis: new Set(context.activeKpis.map((k) => k.key)),
      currentSecondaries: new Set(context.secondaryMethodologies),
    }
  );

  return { ok: true, data: { ...result.data, proposedActions: sanitized } };
}

interface SanitizeContext {
  methodologyKeyByName: (name: string) => string | undefined;
  kpiByKeyOrName: (raw: string) => KpiCatalogItem | undefined;
  roleByKeyOrName: (raw: string) => { key: string; name: string } | undefined;
  memberNames: Set<string>;
  alreadyActiveKpis: Set<string>;
  currentSecondaries: Set<string>;
}

/**
 * Convierte la salida cruda del LLM en `ProposedAction` confiables:
 * descarta acciones con claves inválidas, miembros inexistentes o cambios
 * redundantes (p.ej. activar un KPI que ya está activo). Genera los `id`
 * deterministas que el cliente usa para check/uncheck.
 */
function sanitizeProposedActions(
  raw: RawProposedAction[],
  ctx: SanitizeContext
): ProposedAction[] {
  const out: ProposedAction[] = [];
  const seenIds = new Set<string>();

  for (const entry of raw) {
    const confidence = Math.max(0, Math.min(100, Math.round(Number(entry.confidence) || 0)));
    const label = (entry.label ?? "").toString().trim().slice(0, 120);
    const rationale = (entry.rationale ?? "").toString().trim().slice(0, 240);
    if (!label) continue;

    if (entry.kind === "smart_goal" && entry.goal) {
      const goal: Record<string, string> = {};
      for (const [k, v] of Object.entries(entry.goal)) {
        if (typeof v === "string" && v.trim()) goal[k] = v.trim().slice(0, 2000);
      }
      if (Object.keys(goal).length === 0) continue;
      const id = "smart_goal";
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const action: SmartGoalProposedAction = {
        id,
        kind: "smart_goal",
        label,
        rationale,
        confidence,
        goal: {
          title: goal.title,
          specific: goal.specific,
          measurable: goal.measurable,
          achievable: goal.achievable,
          relevant: goal.relevant,
          timeBound: goal.timeBound,
        },
      };
      out.push(action);
      continue;
    }

    if (entry.kind === "methodology") {
      const normalizeKey = (rawKey: string) =>
        METHODOLOGIES.find((m) => m.key === rawKey)?.key ??
        ctx.methodologyKeyByName(rawKey);
      const add = Array.from(
        new Set((entry.addSecondary ?? []).map(normalizeKey).filter((k): k is string => Boolean(k)))
      ).filter((k) => !ctx.currentSecondaries.has(k));
      const remove = Array.from(
        new Set((entry.removeSecondary ?? []).map(normalizeKey).filter((k): k is string => Boolean(k)))
      ).filter((k) => ctx.currentSecondaries.has(k));
      // Sólo tiene sentido proponerlo si hay algún cambio real.
      const meaningful = add.filter((k) => !remove.includes(k));
      if (add.length === 0 && remove.length === 0) continue;
      if (meaningful.length === 0 && remove.length === 0) continue;
      const id = `methodology:${[...add, ...remove].sort().join(",")}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const action: MethodologyProposedAction = {
        id,
        kind: "methodology",
        label,
        rationale,
        confidence,
        addSecondary: add,
        removeSecondary: remove,
      };
      out.push(action);
      continue;
    }

    if (entry.kind === "kpi") {
      const kpiRaw = (entry.kpiKey ?? entry.kpiName ?? "").toString().trim();
      const catalog = ctx.kpiByKeyOrName(kpiRaw);
      if (!catalog) continue;
      const id = `kpi:${catalog.key}`;
      if (seenIds.has(id)) continue;
      const enabled = entry.enabled !== false;
      // Activar un KPI que ya está activo sin cambiar target/threshold no aporta.
      if (enabled && ctx.alreadyActiveKpis.has(catalog.key) && entry.target == null && entry.alertThreshold == null) {
        continue;
      }
      seenIds.add(id);
      const action: KpiProposedAction = {
        id,
        kind: "kpi",
        label,
        rationale,
        confidence,
        kpiKey: catalog.key,
        kpiName: catalog.name,
        enabled,
        target: typeof entry.target === "number" ? entry.target : null,
        alertThreshold: typeof entry.alertThreshold === "number" ? entry.alertThreshold : null,
      };
      out.push(action);
      continue;
    }

    if (entry.kind === "role") {
      const memberName = (entry.memberName ?? "").toString().trim();
      if (!ctx.memberNames.has(memberName)) continue;
      const role = ctx.roleByKeyOrName((entry.projectRole ?? "").toString().trim());
      if (!role) continue;
      const id = `role:${memberName}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const action: RoleProposedAction = {
        id,
        kind: "role",
        label,
        rationale,
        confidence,
        memberName,
        projectRole: role.key,
        roleName: role.name,
      };
      out.push(action);
      continue;
    }
  }

  // Top 6 por confianza para evitar ruido.
  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 6);
}

export interface MethodologySuggestionInput {
  description: string;
  industry: string | null;
  category: string | null;
}

export interface MethodologySuggestion {
  key: "scrum" | "design_thinking";
  rationale: string;
  confidence: number;
}

/**
 * Pide al LLM que recomiende entre Scrum y Design Thinking en base al
 * objetivo, industria y categoría declarados en el wizard de proyecto.
 * Sólo sugiere; la decisión final la toma el usuario en Configuración.
 */
export async function suggestMethodology(
  input: MethodologySuggestionInput
): Promise<{ ok: boolean; data?: MethodologySuggestion; error?: string }> {
  const description = input.description.trim();
  if (description.length < 8) {
    return { ok: false, error: "Describe tu objetivo para poder sugerir." };
  }

  const prompt = `You are a senior project strategist. Recommend ONE methodology for a new project. You must choose exactly one of these two values: "scrum" or "design_thinking".

Project description: ${description}
Industry: ${input.industry ?? "(unspecified)"}
Category: ${input.category ?? "(unspecified)"}

Decision guide:
- Prefer "scrum" when the goal is delivery-oriented, iterative, with a known product/team and time-boxed milestones (e.g. Lanzamiento, Producto, Operaciones, technology/marketing delivery).
- Prefer "design_thinking" when the goal is discovery-oriented, exploratory, problem-framing or user research (e.g. Investigación, new product lines, undefined problems, design).

Reply with a SINGLE valid JSON object and nothing else (no markdown, no code fences, no commentary). It must follow exactly this shape:
{
  "key": "scrum",
  "rationale": "one short sentence in Spanish explaining why it fits this project",
  "confidence": 75
}
The "key" field MUST be the string scrum or the string design_thinking. The "confidence" field MUST be an integer between 0 and 100.`;

  const result = await generateJSON<MethodologySuggestion>(prompt, {
    maxTokens: 200,
    temperature: 0.25,
  });
  if (!result.ok || !result.data) {
    log.error("suggestMethodology failed", {
      error: result.error,
      model: result.model,
    });
    return { ok: false, error: FRIENDLY_AI_UNAVAILABLE };
  }

  const data = result.data;
  if (data.key !== "scrum" && data.key !== "design_thinking") {
    return { ok: false, error: FRIENDLY_AI_UNAVAILABLE };
  }
  return {
    ok: true,
    data: {
      key: data.key,
      rationale: data.rationale?.trim() || "",
      confidence: Math.max(0, Math.min(100, Number(data.confidence) || 0)),
    },
  };
}

export function kpiCatalogByKey(): Record<string, KpiCatalogItem> {
  return Object.fromEntries(KPI_CATALOG.map((k) => [k.key, k]));
}
