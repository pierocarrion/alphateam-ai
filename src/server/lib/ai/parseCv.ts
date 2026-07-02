import {
  generateContentFromParts,
  generateJSON,
  type GeminiResponse,
} from "@/server/lib/gemini";

/**
 * The five onboarding "role" buckets the user otherwise picks by hand. The CV
 * parser maps any profession onto exactly one of these so the result can drive
 * the existing onboarding step directly.
 */
export const CV_ROLES = [
  "I build / make",
  "I lead a team",
  "I design",
  "I write",
  "A bit of everything",
] as const;
export type CvRole = (typeof CV_ROLES)[number];

export interface ParsedCv {
  role: CvRole | "";
  roleConfidence: number;
  jobTitle: string;
  seniority: "junior" | "mid" | "senior" | "lead" | "";
  skills: string[];
  headline: string;
  yearsExperience: number | null;
}

/** Hard cap on the CV text we send to the model (keeps us safely under token limits). */
const MAX_TEXT_CHARS = 12000;

const SYSTEM_PROMPT = `You are a career-profile extractor. Read a résumé / CV and return concise, factual structured data that lets a productivity app skip a long sign-up form.

Respond ONLY with valid JSON (no markdown, no commentary) using exactly this shape:
{
  "role": "one of: I build / make | I lead a team | I design | I write | A bit of everything",
  "roleConfidence": 0.0-1.0,
  "jobTitle": "current or most recent job title, max 8 words; empty string if unknown",
  "seniority": "one of: junior | mid | senior | lead | empty string if unclear",
  "skills": ["6-12 lowercase short skill tags"],
  "headline": "one warm sentence (max 16 words) describing what this person does, in the CV's language",
  "yearsExperience": number_or_null
}

Rules:
- Map the profession to exactly ONE "role" using the dominant activity:
  • "I build / make" = engineers, developers, makers, scientists, craftspeople who build things.
  • "I lead a team" = managers, directors, founders, leads, team leads, PMs whose core job is leading people.
  • "I design" = designers (UX/UI, graphic, product, industrial), creatives, architects.
  • "I write" = writers, content, marketing-copy, editors, journalists, communicators.
  • "A bit of everything" = when no single category clearly dominates.
- Be conservative: if seniority or years are not clearly stated, return "" or null rather than guessing.
- Write "headline" in the SAME language as the CV (Spanish CV -> Spanish, etc.).
- Never invent employers, emails, phone numbers or addresses.`;

function buildPrompt() {
  return SYSTEM_PROMPT;
}

function normalizeRole(value: unknown): CvRole | "" {
  if (typeof value !== "string") return "";
  const v = value.trim().toLowerCase();
  for (const r of CV_ROLES) {
    if (v === r.toLowerCase()) return r;
  }
  // Loose matching against the most common phrasings.
  if (v.includes("build") || v.includes("make") || v.includes("engineer") || v.includes("develop")) {
    return "I build / make";
  }
  if (v.includes("lead") || v.includes("manag") || v.includes("director") || v.includes("founder")) {
    return "I lead a team";
  }
  if (v.includes("design")) {
    return "I design";
  }
  if (v.includes("writ") || v.includes("content") || v.includes("edit")) {
    return "I write";
  }
  return "";
}

function normalizeSeniority(value: unknown): ParsedCv["seniority"] {
  if (typeof value !== "string") return "";
  const v = value.trim().toLowerCase();
  if (v.startsWith("lead")) return "lead";
  if (v.startsWith("senior") || v === "sr") return "senior";
  if (v.startsWith("junior") || v === "jr") return "junior";
  if (v.startsWith("mid") || v.includes("intermediate")) return "mid";
  return "";
}

function normalizeResult(raw: unknown): ParsedCv {
  const d = (raw ?? {}) as Record<string, unknown>;
  const years =
    typeof d.yearsExperience === "number" && Number.isFinite(d.yearsExperience)
      ? Math.max(0, Math.min(60, Math.round(d.yearsExperience)))
      : null;
  const confidence =
    typeof d.roleConfidence === "number" && Number.isFinite(d.roleConfidence)
      ? Math.max(0, Math.min(1, d.roleConfidence))
      : 0.6;
  return {
    role: normalizeRole(d.role),
    roleConfidence: confidence,
    jobTitle: typeof d.jobTitle === "string" ? d.jobTitle.trim().slice(0, 80) : "",
    seniority: normalizeSeniority(d.seniority),
    skills: Array.isArray(d.skills)
      ? d.skills
          .map((s) => String(s).trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 12)
      : [],
    headline: typeof d.headline === "string" ? d.headline.trim().slice(0, 160) : "",
    yearsExperience: years,
  };
}

/**
 * Parse a CV held as plain text (already extracted from .txt/.md/.docx, or pasted).
 * Falls under the text-only Gemini path.
 */
export async function parseCvTextWithGemini(text: string): Promise<GeminiResponse<ParsedCv>> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "Empty CV text", model: "gemini" };
  }
  const snippet = trimmed.slice(0, MAX_TEXT_CHARS);
  const prompt = `${buildPrompt()}

CV text:
"""${snippet}"""`;

  const result = await generateJSON<ParsedCv>(prompt, { maxTokens: 500, temperature: 0.2 });
  if (!result.ok || !result.data) return result;
  return { ok: true, data: normalizeResult(result.data), model: result.model };
}

/**
 * Parse a CV delivered as a PDF buffer. Gemini accepts application/pdf natively
 * as inline data, so we skip a local PDF parser entirely and let the model read
 * the document directly.
 */
export async function parseCvPdfWithGemini(pdf: Buffer): Promise<GeminiResponse<ParsedCv>> {
  if (!pdf || pdf.byteLength === 0) {
    return { ok: false, error: "Empty CV file", model: "gemini" };
  }
  const parts = [
    { inlineData: { data: pdf.toString("base64"), mimeType: "application/pdf" } },
    { text: buildPrompt() },
  ];
  const result = await generateContentFromParts(parts, { maxTokens: 500, temperature: 0.2 });
  if (!result.ok || !result.data) {
    return { ok: false, error: result.error, model: result.model };
  }

  const cleaned = result.data.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as ParsedCv;
    return { ok: true, data: normalizeResult(parsed), model: result.model };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `JSON parse error: ${message}`, model: result.model };
  }
}
