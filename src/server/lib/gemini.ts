import { VertexAI } from "@google-cloud/vertexai";
import { DetectedTaskDraft } from "@/features/tasks/lib/detect";

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
    console.warn("[gemini] GOOGLE_CLOUD_PROJECT_ID or VERTEX_AI_LOCATION missing");
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

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 512,
        temperature: options.temperature ?? 0.25,
      },
    });

    const response = result.response;
    const candidate = response.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text?.trim() ?? "";

    if (!text) {
      return { ok: false, error: "Empty response from Gemini", model: modelName };
    }

    return { ok: true, data: text, model: modelName };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[gemini] generateContent error:", message);
    return { ok: false, error: message, model: modelName };
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
}

export async function generateMiraResponse(context: MiraChatContext): Promise<GeminiResponse<string>> {
  const prompt = `You are Mira, a warm, encouraging productivity companion orb. You help people start tasks without guilt.

User: ${context.userName ?? "there"}
Mood: ${context.mood ?? "unspecified"}
Recent tasks: ${context.recentTasks?.join(", ") ?? "none"}

User message: """${context.message}"""

Respond in a friendly, concise way (max 2 sentences). Validate any stress, then suggest one tiny next step.`;

  return generateContent(prompt, { maxTokens: 150, temperature: 0.4 });
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
