import type { Locale } from "@/i18n/messages";
import { t } from "@/i18n/messages";

/**
 * Suggested questions for the Assistant drawer.
 *
 * Each suggestion also carries a follow-up prompt for the "Compare" / "Explain
 * more" quick actions, so the user gets a consistent experience when they
 * click a chip vs. type a free-form question.
 */
export interface SuggestedQuestion {
  id: string;
  chipKey: string;
  /** Question text in the active locale (what the user sees & sends). */
  text: (locale: Locale) => string;
}

export const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  { id: "explain", chipKey: "insights.assistant.chip.explain", text: (l) => t(l, "insights.assistant.chip.explain") },
  { id: "worry", chipKey: "insights.assistant.chip.worry", text: (l) => t(l, "insights.assistant.chip.worry") },
  { id: "healthy", chipKey: "insights.assistant.chip.healthy", text: (l) => t(l, "insights.assistant.chip.healthy") },
  { id: "attention", chipKey: "insights.assistant.chip.attention", text: (l) => t(l, "insights.assistant.chip.attention") },
  { id: "whyRisk", chipKey: "insights.assistant.chip.whyRisk", text: (l) => t(l, "insights.assistant.chip.whyRisk") },
  { id: "summary", chipKey: "insights.assistant.chip.summary", text: (l) => t(l, "insights.assistant.chip.summary") },
  { id: "recommend", chipKey: "insights.assistant.chip.recommend", text: (l) => t(l, "insights.assistant.chip.recommend") },
  { id: "trends", chipKey: "insights.assistant.chip.trends", text: (l) => t(l, "insights.assistant.chip.trends") },
];
