import { VertexAI } from "@google-cloud/vertexai";
import { DetectedTaskDraft } from "@/features/tasks/lib/detect";
import { createLogger } from "@/shared/lib/logger";

const log = createLogger("gemini");

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID ?? "";
const location = process.env.VERTEX_AI_LOCATION ?? "us-central1";
const modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const GEMINI_ENABLED = process.env.GEMINI_ENABLED === "true";
const GEMINI_FALLBACK = process.env.GEMINI_FALLBACK !== "false"; // default true

let vertexAI: VertexAI | null = null;
let generativeModel: ReturnType<VertexAI["preview"]["getGenerativeModel"]> | null = null;

function getModel() {
  if (!GEMINI_ENABLED) return null;
  if (!projectId || !location) {
    log.warn("GOOGLE_CLOUD_PROJECT_ID or VERTEX_AI_LOCATION missing");
    return null;
  }
  if (!generativeModel) {
    vertexAI = new VertexAI({ project: projectId, location });
    generativeModel = vertexAI.preview.getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens: 512,
        temperature: 0.25,
        topP: 0.95,
        topK: 40,
      },
    });
  }
  return generativeModel;
}

export function isGeminiEnabled(): boolean {
  return GEMINI_ENABLED;
}

export function shouldUseFallback(): boolean {
  return GEMINI_FALLBACK;
}

const FRIENDLY_GEMINI_QUOTA = "We're hitting our AI limit right now. Please try again in a moment.";
const FRIENDLY_GEMINI_UNAVAILABLE = "Our AI service isn't reachable right now. Please try again in a moment.";
const FRIENDLY_GEMINI_DEFAULT = "We couldn't process that with AI right now. Please try again in a moment.";
const FRIENDLY_GEMINI_PARSE = "Our AI returned something we couldn't read. Please try again.";
const FRIENDLY_GEMINI_EMPTY = "Our AI didn't respond. Please try again.";
const FRIENDLY_GEMINI_DISABLED = "AI features aren't enabled right now.";

export function toFriendlyGeminiError(error: string | undefined): string {
  if (!error) return FRIENDLY_GEMINI_DEFAULT;
  const lower = error.toLowerCase();
  if (lower.includes("quota") || lower.includes("rate_limit") || lower.includes("resource_exhausted") || lower.includes("429")) {
    return FRIENDLY_GEMINI_QUOTA;
  }
  if (lower.includes("permission_denied") || lower.includes("unauthenticated") || lower.includes("401") || lower.includes("403")) {
    return FRIENDLY_GEMINI_UNAVAILABLE;
  }
  if (lower.includes("not enabled") || lower.includes("misconfigured")) {
    return FRIENDLY_GEMINI_DISABLED;
  }
  if (lower.includes("json parse error") || lower.includes("unexpected token")) {
    return FRIENDLY_GEMINI_PARSE;
  }
  if (lower.includes("empty response")) {
    return FRIENDLY_GEMINI_EMPTY;
  }
  if (lower.includes("unavailable") || lower.includes("timeout") || lower.includes("deadline") || lower.includes("503") || lower.includes("500")) {
    return FRIENDLY_GEMINI_UNAVAILABLE;
  }
  return FRIENDLY_GEMINI_DEFAULT;
}

export interface GeminiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  model: string;
}

export async function generateContent(
  prompt: string,
  options: { maxTokens?: number; temperature?: number; json?: boolean } = {}
): Promise<GeminiResponse<string>> {
  const model = getModel();
  if (!model) {
    return { ok: false, error: "Gemini not enabled or misconfigured", model: modelName };
  }

  const systemHint = options.json
    ? "Respond ONLY with valid JSON. Do not include markdown code fences or explanations."
    : "";
  const fullPrompt = systemHint ? `${systemHint}\n\n${prompt}` : prompt;

  const callModel = async (): Promise<string> => {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 512,
        temperature: options.temperature ?? 0.25,
      },
    });
    const candidate = result.response?.candidates?.[0];
    return candidate?.content?.parts?.[0]?.text?.trim() ?? "";
  };

  const MAX_ATTEMPTS = 2; // initial + 1 retry
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const text = await callModel();
      if (!text) {
        log.warn("empty response from model", { model: modelName, attempt });
        return { ok: false, error: "Empty response from Gemini", model: modelName };
      }
      return { ok: true, data: text, model: modelName };
    } catch (err) {
      const isTransient = isTransientError(err);
      log.error("generateContent error", {
        attempt,
        transient: isTransient,
        model: modelName,
        message: err instanceof Error ? err.message : String(err),
        code: (err as { code?: unknown }).code ?? undefined,
        status: (err as { status?: unknown }).status ?? undefined,
        stack: err instanceof Error ? err.stack : undefined,
        cause:
          err instanceof Error && err.cause
            ? JSON.stringify(err.cause, Object.getOwnPropertyNames(err.cause))
            : undefined,
      });

      if (isTransient && attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 600 * attempt)); // backoff
        continue;
      }
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message, model: modelName };
    }
  }
}

export async function generateJSON<T>(
  prompt: string,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<GeminiResponse<T>> {
  const textResult = await generateContent(prompt, { ...options, json: true });
  if (!textResult.ok || !textResult.data) {
    return { ok: false, error: textResult.error, model: textResult.model };
  }

  let cleaned = textResult.data;
  // Strip markdown fences if the model ignored the instruction
  cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");

  try {
    const parsed = JSON.parse(cleaned) as T;
    return { ok: true, data: parsed, model: textResult.model };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `JSON parse error: ${message}`, model: textResult.model };
  }
}

export interface GeminiTaskDetection {
  isTask: boolean;
  title: string;
  category: string;
  app: string;
  due: string;
  load: "Light" | "Medium" | "Heavy";
  micro: string;
  action: string;
  resource: string;
  confidence: number;
  reasoning: string;
}

export async function detectTaskWithGemini(
  message: string,
  fromWho?: string
): Promise<GeminiResponse<GeminiTaskDetection>> {
  const prompt = `You are Mira, a gentle productivity companion. Analyze the following message and decide if it describes a task or commitment.

Message: """${message}"""
Sender context: ${fromWho ? `assigned by/to ${fromWho}` : "self-generated"}

Respond with JSON only:
{
  "isTask": boolean,
  "title": "short task title, max 8 words",
  "category": "one of: Slides, Docs, Comms, Build, Meetings, Review, General",
  "app": "plausible app name for this category",
  "due": "human deadline like 'tomorrow' or 'no deadline yet'",
  "load": "Light | Medium | Heavy",
  "micro": "a 2-minute first step that feels kind and doable",
  "action": "the very first tiny action",
  "resource": "plausible document or tool name",
  "confidence": 0.0-1.0,
  "reasoning": "one sentence why this is or isn't a task"
}`;

  return generateJSON<GeminiTaskDetection>(prompt, { maxTokens: 400, temperature: 0.2 });
}

export async function generateMicroStep(task: {
  title: string;
  category: string;
  load: string;
}): Promise<GeminiResponse<string>> {
  const prompt = `You are Mira, a kind anti-procrastination companion. The user is facing this task:

Title: ${task.title}
Category: ${task.category}
Load: ${task.load}

Write ONE short, warm, 2-minute first step. Keep it under 20 words. No lists, no pressure.`;

  return generateContent(prompt, { maxTokens: 80, temperature: 0.3 });
}

export interface MiraChatContext {
  userName?: string;
  recentTasks?: string[];
  mood?: string;
  message: string;
  knowledge?: Array<{ title: string; content: string }>;
  projectContext?: {
    name?: string;
    description?: string;
    industry?: string;
    category?: string;
  } | null;
}

export async function generateMiraResponse(context: MiraChatContext): Promise<GeminiResponse<string>> {
  const knowledgeBlock =
    context.knowledge && context.knowledge.length > 0
      ? `\n\nProject knowledge base — this is everything you actually know about this project. Ground your answer ONLY on it when the question is about the project:\n${context.knowledge
          .map((k) => `### ${k.title}\n${k.content}`)
          .join("\n\n")}\n`
      : "\n\nProject knowledge base: (empty — nothing documented yet)\n";

  const projectBlock = context.projectContext
    ? `\nProject context:\n- Name: ${context.projectContext.name ?? "(unknown)"}\n- Description: ${context.projectContext.description ?? "(none)"}\n- Industry: ${context.projectContext.industry ?? "(unspecified)"}\n- Category: ${context.projectContext.category ?? "(unspecified)"}\n`
    : "";

  const prompt = `You are Mira, a warm, concise, honest productivity companion embedded in a team's project chat. You were @mentioned, so reply directly to the user.${projectBlock}${knowledgeBlock}

User: ${context.userName ?? "there"}
Mood: ${context.mood ?? "unspecified"}
Recent tasks: ${context.recentTasks?.join(", ") ?? "none"}

RULES (follow in order):
1. LANGUAGE: Detect the language of the user's message and ALWAYS reply in that exact same language (Spanish → Spanish, English → English). Never default to English.
2. ANSWER THE QUESTION DIRECTLY. Read what the user asked and respond to THAT. Do not reply with a generic greeting, congratulations, or filler ("¡Hola!", "Qué buena", "Great question") when the user asked a specific question. A tiny warm opener is fine, but the substance must address the question.
3. BE HONEST ABOUT THE PROJECT. If the question is about a project decision, choice, or fact (e.g. tech stack, deadlines, who does what) and the answer is NOT in the project knowledge base or project context above, DO NOT invent or guess. Say clearly that it is not documented yet in the knowledge base, and suggest the team capture it (or ask the project leader). It is far better to say "Todavía no tengo eso documentado" than to make something up.
4. Use the knowledge base as the source of truth when it covers the topic; otherwise rely on general knowledge ONLY for generic/non-project questions.
5. Be friendly and concise (max 3 sentences). When it fits, end with one small, kind next step.

User message: """${context.message}"""`;

  return generateContent(prompt, { maxTokens: 260, temperature: 0.4 });
}

export interface ExtractedAnswer {
  isAnswer: boolean;
  title: string;
  content: string;
  duplicate: boolean;
  confidence: number;
}

/**
 * Asks Gemini to decide whether a team leader's chat reply is a reusable answer
 * worth saving to the project knowledge base, and to produce a clean Q&A entry.
 */
export async function extractLeaderAnswerToKnowledge(args: {
  question: string;
  leaderAnswer: string;
  existingKnowledgeTitles: string[];
  leaderName?: string;
}): Promise<GeminiResponse<ExtractedAnswer>> {
  const titles = args.existingKnowledgeTitles.length
    ? args.existingKnowledgeTitles.map((t) => `"${t}"`).join(", ")
    : "(empty)";

  const prompt = `You are a knowledge-curation assistant for a team project. Decide whether a team leader's chat reply is a reusable answer worth saving to the project knowledge base.

Conversation:
- Member question: """${args.question}"""
${args.leaderName ? `- Leader (${args.leaderName}) reply: """${args.leaderAnswer}"""` : `- Leader reply: """${args.leaderAnswer}"""`}

Existing knowledge base titles: ${titles}

Rules:
- Set "isAnswer" to true ONLY if the leader's reply is a substantive, reusable answer to the question (not a greeting, yes/no, or chitchat).
- Set "duplicate" to true if the answer is already covered by an existing knowledge base title (compare by meaning, case-insensitive).
- Write "title" as a short topic title (max 8 words). Write "content" as a clear, self-contained answer in English (1-4 sentences) that makes sense without the original question.
- If it isn't a real reusable answer, set isAnswer=false and leave title and content empty.

Respond with JSON only:
{
  "isAnswer": boolean,
  "title": "string",
  "content": "string",
  "duplicate": boolean,
  "confidence": 0.0-1.0
}`;

  return generateJSON<ExtractedAnswer>(prompt, { maxTokens: 300, temperature: 0.2 });
}

export interface CrewMoodAnalysis {
  mood: { value: number; label: string };
  signals: Array<{
    type: "load_imbalance" | "deadline_risk" | "mood_dip" | "procrastination_spike" | "recovery_win";
    severity: "low" | "medium" | "high";
    summary: string;
    userId?: string;
    suggestedAction?: string;
  }>;
}

export async function analyzeCrewMood(
  messages: Array<{ userId: string; text: string; createdAt: string }>
): Promise<GeminiResponse<CrewMoodAnalysis>> {
  const prompt = `You are a team-health analyst. Given recent team chat messages, estimate overall mood and surface any risks.

Messages:
${messages.map((m) => `- ${m.userId} (${m.createdAt}): ${m.text}`).join("\n")}

Respond with JSON only:
{
  "mood": { "value": 0-100, "label": "positive | neutral | stressed | overwhelmed" },
  "signals": [
    {
      "type": "load_imbalance | deadline_risk | mood_dip | procrastination_spike | recovery_win",
      "severity": "low | medium | high",
      "summary": "short description",
      "userId": "optional user id",
      "suggestedAction": "optional supportive action"
    }
  ]
}`;

  return generateJSON<CrewMoodAnalysis>(prompt, { maxTokens: 400, temperature: 0.2 });
}

/* ------------------------------------------------------------------ */
/* Leader intelligence                                                */
/* ------------------------------------------------------------------ */

export type MessageClass =
  | "Normal"
  | "Important"
  | "Urgent"
  | "Risk"
  | "Blocker"
  | "Decision";

export interface ClassifiedMessage {
  classification: MessageClass;
  intent: string;
  priority: "Low" | "Medium" | "High";
}

export async function classifyMessage(
  text: string
): Promise<GeminiResponse<ClassifiedMessage>> {
  const prompt = `You are Mira, a project assistant for a team leader. Classify this chat message.

Message: """${text}"""

Respond with JSON only:
{
  "classification": "Normal | Important | Urgent | Risk | Blocker | Decision",
  "intent": "one short phrase describing what the sender wants",
  "priority": "Low | Medium | High"
}

Rules:
- "Blocker" = sender can't continue (no access, waiting approval, stuck).
- "Decision" = sender is explicitly asking the leader to approve/decide.
- "Risk" = signal that delivery is in jeopardy (delay, dependency, scope).
- "Urgent" = time-sensitive but not a blocker/decision.
- "Important" = meaningful but not time-critical.
- "Normal" = chitchat or routine updates.`;

  return generateJSON<ClassifiedMessage>(prompt, {
    maxTokens: 160,
    temperature: 0.15,
  });
}

export interface ImplicitMention {
  mentionsLeader: boolean;
  reason: string;
}

export async function detectImplicitLeaderMention(
  text: string,
  leaderName: string
): Promise<GeminiResponse<ImplicitMention>> {
  const prompt = `You detect whether a chat message implicitly references the team leader (not via "@leader" but by intent).

Leader's name: ${leaderName}
Message: """${text}"""

Respond with JSON only:
{
  "mentionsLeader": boolean,
  "reason": "short phrase if true, otherwise empty"
}

Set mentionsLeader=true when the message asks the leader to approve, validate, decide, sign off, or unblock — even without naming them.`;

  return generateJSON<ImplicitMention>(prompt, {
    maxTokens: 120,
    temperature: 0.15,
  });
}

export interface RiskAssessment {
  riskScore: number; // 0-100
  level: "low" | "medium" | "high" | "critical";
  reasons: string[];
}

export async function scoreProjectRisk(args: {
  signals: string[];
  overdueTasks: number;
  activeBlockers: number;
  overloadedMembers: number;
}): Promise<GeminiResponse<RiskAssessment>> {
  const prompt = `You are a project risk model. Given signals about a sprint, return a risk score.

Overdue tasks: ${args.overdueTasks}
Active blockers: ${args.activeBlockers}
Overloaded members: ${args.overloadedMembers}

Signals:
${args.signals.map((s) => `- ${s}`).join("\n") || "- (none)"}

Respond with JSON only:
{
  "riskScore": 0-100,
  "level": "low | medium | high | critical",
  "reasons": ["short reason", "..."]
}

Score guidance: <30 low, 30-55 medium, 55-80 high, >80 critical.`;

  return generateJSON<RiskAssessment>(prompt, {
    maxTokens: 260,
    temperature: 0.2,
  });
}

export interface AssigneeRecommendation {
  recommendedUser: string | null;
  confidence: number; // 0-100
  reasoning: string;
}

export async function recommendAssignee(args: {
  taskTitle: string;
  candidates: Array<{ name: string; openTasks: number; skills: string[] }>;
}): Promise<GeminiResponse<AssigneeRecommendation>> {
  const prompt = `You recommend who should own a task based on skills, current load, and fit.

Task: """${args.taskTitle}"""

Candidates:
${args.candidates
  .map(
    (c) =>
      `- ${c.name} · open tasks: ${c.openTasks} · skills: ${c.skills.join(", ") || "n/a"}`
  )
  .join("\n") || "- (none)"}

Respond with JSON only:
{
  "recommendedUser": "name or null",
  "confidence": 0-100,
  "reasoning": "one short sentence"
}

Prefer lower load and matching skills. If no one fits, set recommendedUser to null.`;

  return generateJSON<AssigneeRecommendation>(prompt, {
    maxTokens: 180,
    temperature: 0.25,
  });
}

export interface DelayPrediction {
  probabilityDelay: number; // 0-100
  reasoning: string;
}

export async function predictTaskDelay(args: {
  taskTitle: string;
  ageDays: number;
  hasDeadline: boolean;
  daysUntilDeadline: number | null;
  ownerOpenTasks: number;
}): Promise<GeminiResponse<DelayPrediction>> {
  const prompt = `Predict the probability (0-100) that this task will be delivered late.

Task: """${args.taskTitle}"""
Age (days since creation): ${args.ageDays}
Has deadline: ${args.hasDeadline}
Days until deadline: ${args.daysUntilDeadline ?? "n/a"}
Owner's open tasks right now: ${args.ownerOpenTasks}

Respond with JSON only:
{
  "probabilityDelay": 0-100,
  "reasoning": "one short sentence"
}`;

  return generateJSON<DelayPrediction>(prompt, {
    maxTokens: 150,
    temperature: 0.2,
  });
}

export interface LeaderBriefing {
  headline: string;
  bullets: string[];
  needsAttention: string[];
}

export async function generateLeaderBriefing(args: {
  leaderName: string;
  hours: number;
  events: Array<{ kind: string; detail: string }>;
}): Promise<GeminiResponse<LeaderBriefing>> {
  const prompt = `You are Mira, briefing a team leader who just came back after ${args.hours} hours. Distill what happened into a calm, clear summary — no noise, no fear, just signal.

Leader: ${args.leaderName}

Raw events (already filtered, may be empty):
${args.events.map((e) => `- [${e.kind}] ${e.detail}`).join("\n") || "- (none)"}

Respond with JSON only:
{
  "headline": "one warm sentence framing the period",
  "bullets": ["3-6 concise bullets, grouped by theme, no emojis"],
  "needsAttention": ["only items that truly need the leader now; empty array if none"]
}

Drop chitchat and duplicates. Group similar events. Prioritize decisions, blockers, risks and deadlines.`;

  return generateJSON<LeaderBriefing>(prompt, {
    maxTokens: 420,
    temperature: 0.3,
  });
}

export interface LeaderChatAnswer {
  answer: string;
  followUp: string | null;
}

export async function answerLeaderQuestion(args: {
  question: string;
  context: string;
}): Promise<GeminiResponse<LeaderChatAnswer>> {
  const prompt = `You are Mira, answering a team leader's question about their project. Be concise and grounded in the provided context. If the context is missing something, say so briefly.

Context:
${args.context}

Question: """${args.question}"""

Respond with JSON only:
{
  "answer": "2-4 sentences max, plain English",
  "followUp": "one suggested next step, or null"
}`;

  return generateJSON<LeaderChatAnswer>(prompt, {
    maxTokens: 260,
    temperature: 0.3,
  });
}

function isTransientError(err: unknown): boolean {
  if (!err) return false;
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  const code = (err as { code?: number | string }).code;
  const status = (err as { status?: number | string }).status;
  const signals = [
    "503",
    "500",
    "unavailable",
    "timeout",
    "deadline",
    "rate_limit",
    "resource_exhausted",
    "429",
    "reset",
    "connection",
    "temporarily",
  ];
  if (code === 503 || code === 429 || code === 500) return true;
  if (status === 503 || status === 429 || status === 500) return true;
  return signals.some((s) => message.includes(s));
}

export function geminiDraftToDetectedTaskDraft(
  draft: GeminiTaskDetection,
  originalText: string,
  fromWho?: string
): DetectedTaskDraft {
  return {
    title: draft.title || originalText.slice(0, 60),
    fromQuote: `“${originalText.length > 60 ? originalText.slice(0, 60) + "…" : originalText}”`,
    category: draft.category || "General",
    app: draft.app || "Knowledge base",
    due: draft.due || "no deadline yet",
    deadline: null,
    load: ["Light", "Medium", "Heavy"].includes(draft.load) ? draft.load : "Light",
    micro: draft.micro || "Spend 2 minutes looking at it. That counts.",
    action: draft.action || "the first tiny piece",
    resource: draft.resource || "Untitled.doc",
    selfMade: fromWho ? false : true,
    confidence: typeof draft.confidence === "number" ? draft.confidence : 0.8,
  };
}
